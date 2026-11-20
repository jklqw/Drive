from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_owned_file, get_owned_share
from app.core.limiter import limiter
from app.core.security import generate_share_token, sha256_token
from app.db.session import get_db
from app.models import FileRecord, ShareLink, User
from app.schemas.share import PublicShareInfo, ShareCreateRequest, ShareCreatedResponse, ShareResponse
from app.services.audit_service import client_ip, log_event
from app.services.storage_service import resolve_safe_path, safe_download_headers

router = APIRouter(tags=["sharing"])

CHUNK_SIZE = 64 * 1024


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _naive_utcnow() -> datetime:
    """SQLite stores timestamps without tzinfo; use naive UTC for SQL comparisons."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


async def _iter_file(path) -> AsyncIterator[bytes]:
    with open(path, "rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            yield chunk


async def _validate_active_share(db: AsyncSession, raw_token: str) -> ShareLink:
    share = await db.scalar(
        select(ShareLink).where(
            ShareLink.token_hash == sha256_token(raw_token),
            ShareLink.is_revoked.is_(False),
        )
    )
    if share is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
    now = _utcnow()
    if share.expires_at is not None and _as_utc(share.expires_at) < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link expired")
    if share.max_downloads is not None and share.download_count >= share.max_downloads:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download limit reached")
    return share


@router.post(
    "/files/{file_id}/share",
    response_model=ShareCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_share(
    payload: ShareCreateRequest,
    request: Request,
    file: FileRecord = Depends(get_owned_file),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShareCreatedResponse:
    raw_token = generate_share_token()
    expires_at = _utcnow() + timedelta(hours=payload.expires_in_hours) if payload.expires_in_hours else None
    share = ShareLink(
        file_id=file.id,
        created_by=user.id,
        token_hash=sha256_token(raw_token),
        expires_at=expires_at,
        max_downloads=payload.max_downloads,
        download_count=0,
        is_revoked=False,
    )
    db.add(share)
    await log_event(
        db,
        action="SHARE_CREATED",
        resource_type="share",
        resource_id=str(share.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={
            "file_id": str(file.id),
            "expires_in_hours": payload.expires_in_hours,
            "max_downloads": payload.max_downloads,
        },
    )
    await db.commit()
    await db.refresh(share)
    data = ShareResponse.model_validate(share).model_dump()
    data.update({"filename": file.original_filename, "token": raw_token, "url": f"/s/{raw_token}"})
    return ShareCreatedResponse(**data)


@router.get("/shares", response_model=list[ShareResponse])
async def list_shares(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShareResponse]:
    rows = (
        await db.execute(
            select(ShareLink, FileRecord.original_filename)
            .join(FileRecord, FileRecord.id == ShareLink.file_id)
            .where(ShareLink.created_by == user.id)
            .order_by(ShareLink.created_at.desc())
        )
    ).all()
    return [
        ShareResponse.model_validate(share).model_copy(update={"filename": filename})
        for share, filename in rows
    ]


@router.delete("/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    request: Request,
    share: ShareLink = Depends(get_owned_share),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    share.is_revoked = True
    await log_event(
        db,
        action="SHARE_REVOKED",
        resource_type="share",
        resource_id=str(share.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={"file_id": str(share.file_id)},
    )
    await db.commit()


@router.get("/public/share/{raw_token}", response_model=PublicShareInfo)
@limiter.limit("30/minute")
async def public_share_info(
    raw_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PublicShareInfo:
    share = await _validate_active_share(db, raw_token)
    file = await db.get(FileRecord, share.file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
    return PublicShareInfo(
        filename=file.original_filename,
        size_bytes=file.size_bytes,
        detected_mime_type=file.detected_mime_type,
        sha256_hash=file.sha256_hash,
        expires_at=share.expires_at,
        download_count=share.download_count,
        max_downloads=share.max_downloads,
    )


@router.get("/public/share/{raw_token}/download")
@limiter.limit("30/minute")
async def public_share_download(
    raw_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    share = await _validate_active_share(db, raw_token)
    file = await db.get(FileRecord, share.file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")

    # Conditional increment is atomic: concurrent requests cannot exceed the cap.
    result = await db.execute(
        update(ShareLink)
        .where(
            ShareLink.id == share.id,
            ShareLink.is_revoked.is_(False),
            or_(ShareLink.expires_at.is_(None), ShareLink.expires_at > _naive_utcnow()),
            or_(ShareLink.max_downloads.is_(None), ShareLink.download_count < ShareLink.max_downloads),
        )
        .values(download_count=ShareLink.download_count + 1)
        .returning(ShareLink.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link unavailable")

    path = resolve_safe_path(file.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored object missing")
    await log_event(
        db,
        action="SHARE_DOWNLOADED",
        resource_type="share",
        resource_id=str(share.id),
        user_id=share.created_by,
        ip_address=client_ip(request),
        details={"file_id": str(file.id)},
        commit=True,
    )
    return StreamingResponse(
        _iter_file(path),
        media_type=file.detected_mime_type,
        headers=safe_download_headers(file.original_filename),
    )
