import hashlib
import os
import uuid
from typing import AsyncIterator

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_owned_file
from app.core.config import settings
from app.db.session import get_db
from app.models import FileRecord, Folder, User
from app.schemas.file import FileRename, FileResponse
from app.services.audit_service import client_ip, log_event
from app.services.file_validator import extract_extension, safe_display_name
from app.services.storage_service import (
    apply_file_permissions,
    delete_physical,
    new_storage_key,
    resolve_safe_path,
    safe_download_headers,
)

router = APIRouter(prefix="/files", tags=["files"])

CHUNK_SIZE = 64 * 1024


async def _iter_file(path) -> AsyncIterator[bytes]:
    with open(path, "rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            yield chunk


@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    folder_id: uuid.UUID | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileRecord:
    if folder_id is not None:
        folder = await db.scalar(select(Folder).where(Folder.id == folder_id, Folder.owner_id == user.id))
        if folder is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    try:
        display_name = safe_display_name(file.filename or "")
        extension = extract_extension(display_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage_key = new_storage_key()
    target = resolve_safe_path(storage_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{storage_key}.part")

    digest = hashlib.sha256()
    written = 0
    try:
        # Read a header first so security inspection can reject bad content
        # before any significant amount of data is persisted.
        header = await file.read(4096)
        await file.seek(0)
        async with aiofiles.open(temporary, "wb") as output:
            while chunk := await file.read(CHUNK_SIZE):
                written += len(chunk)
                if written > settings.MAX_FILE_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds the maximum allowed size",
                    )
                digest.update(chunk)
                await output.write(chunk)
        del header

        locked_user = await db.scalar(select(User).where(User.id == user.id).with_for_update())
        if locked_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account unavailable")
        if locked_user.storage_used_bytes + written > locked_user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Storage quota exceeded",
            )

        record = FileRecord(
            owner_id=user.id,
            folder_id=folder_id,
            original_filename=display_name,
            storage_key=storage_key,
            detected_mime_type=file.content_type or "application/octet-stream",
            extension=extension,
            size_bytes=written,
            sha256_hash=digest.hexdigest(),
        )
        os.replace(temporary, target)
        apply_file_permissions(target)

        locked_user.storage_used_bytes += written
        db.add(record)
        await log_event(
            db,
            action="UPLOAD_SUCCESS",
            resource_type="file",
            resource_id=str(record.id),
            user_id=user.id,
            ip_address=client_ip(request),
            details={"filename": display_name, "size_bytes": written, "mime": record.detected_mime_type},
        )
        try:
            await db.commit()
        except Exception:
            target.unlink(missing_ok=True)
            raise
        await db.refresh(record)
        return record
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


@router.get("/{file_id}/download")
async def download_file(
    request: Request,
    record: FileRecord = Depends(get_owned_file),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    path = resolve_safe_path(record.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored object missing")
    await log_event(
        db,
        action="FILE_DOWNLOADED",
        resource_type="file",
        resource_id=str(record.id),
        user_id=record.owner_id,
        ip_address=client_ip(request),
        commit=True,
    )
    return StreamingResponse(
        _iter_file(path),
        media_type=record.detected_mime_type,
        headers=safe_download_headers(record.original_filename),
    )


@router.patch("/{file_id}", response_model=FileResponse)
async def rename_file(
    payload: FileRename,
    request: Request,
    record: FileRecord = Depends(get_owned_file),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileRecord:
    previous = record.original_filename
    record.original_filename = payload.name
    await log_event(
        db,
        action="FILE_RENAMED",
        resource_type="file",
        resource_id=str(record.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={"from": previous, "to": payload.name},
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    request: Request,
    record: FileRecord = Depends(get_owned_file),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    locked_user = await db.scalar(select(User).where(User.id == user.id).with_for_update())
    if locked_user is not None:
        locked_user.storage_used_bytes = max(0, locked_user.storage_used_bytes - record.size_bytes)

    await log_event(
        db,
        action="FILE_DELETED",
        resource_type="file",
        resource_id=str(record.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={"filename": record.original_filename, "bytes_reclaimed": record.size_bytes},
    )
    await db.delete(record)
    await db.commit()
    await delete_physical(record.storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
