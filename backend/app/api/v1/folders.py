import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_owned_folder
from app.db.session import get_db
from app.models import FileRecord, Folder, User
from app.schemas.file import FileResponse
from app.schemas.folder import BreadcrumbItem, ContentsResponse, FolderCreate, FolderResponse, FolderRename
from app.services.audit_service import client_ip, log_event
from app.services.storage_service import delete_physical

router = APIRouter(prefix="/folders", tags=["folders"])


async def _breadcrumbs(db: AsyncSession, user: User, folder_id: uuid.UUID | None) -> list[BreadcrumbItem]:
    chain: list[BreadcrumbItem] = []
    cursor = folder_id
    visited: set[uuid.UUID] = set()
    while cursor is not None and cursor not in visited:
        visited.add(cursor)
        folder = await db.scalar(select(Folder).where(Folder.id == cursor, Folder.owner_id == user.id))
        if folder is None:
            break
        chain.append(BreadcrumbItem(id=folder.id, name=folder.name))
        cursor = folder.parent_id
    chain.reverse()
    return chain


async def _contents(db: AsyncSession, user: User, parent_id: uuid.UUID | None) -> ContentsResponse:
    folders = (
        await db.execute(
            select(Folder)
            .where(Folder.owner_id == user.id, Folder.parent_id == parent_id)
            .order_by(Folder.name.asc())
        )
    ).scalars().all()
    files = (
        await db.execute(
            select(FileRecord)
            .where(FileRecord.owner_id == user.id, FileRecord.folder_id == parent_id)
            .order_by(FileRecord.original_filename.asc())
        )
    ).scalars().all()
    return ContentsResponse(
        folders=[FolderResponse.model_validate(folder) for folder in folders],
        files=[FileResponse.model_validate(file) for file in files],
        breadcrumbs=await _breadcrumbs(db, user, parent_id),
    )


async def _assert_unique_sibling_name(
    db: AsyncSession,
    user: User,
    parent_id: uuid.UUID | None,
    name: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    query = select(Folder.id).where(Folder.owner_id == user.id, Folder.parent_id == parent_id, Folder.name == name)
    if exclude_id is not None:
        query = query.where(Folder.id != exclude_id)
    if await db.scalar(query) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A folder with this name already exists here")


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Folder:
    if payload.parent_id is not None:
        parent = await db.scalar(
            select(Folder).where(Folder.id == payload.parent_id, Folder.owner_id == user.id)
        )
        if parent is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")

    await _assert_unique_sibling_name(db, user, payload.parent_id, payload.name)
    folder = Folder(name=payload.name, owner_id=user.id, parent_id=payload.parent_id)
    db.add(folder)
    await log_event(
        db,
        action="FOLDER_CREATED",
        resource_type="folder",
        resource_id=str(folder.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={"name": payload.name, "parent_id": str(payload.parent_id) if payload.parent_id else None},
    )
    await db.commit()
    await db.refresh(folder)
    return folder


@router.get("", response_model=ContentsResponse)
async def list_root_contents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentsResponse:
    return await _contents(db, user, None)


@router.get("/{folder_id}/contents", response_model=ContentsResponse)
async def list_folder_contents(
    folder: Folder = Depends(get_owned_folder),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentsResponse:
    return await _contents(db, user, folder.id)


@router.patch("/{folder_id}", response_model=FolderResponse)
async def rename_folder(
    payload: FolderRename,
    request: Request,
    folder: Folder = Depends(get_owned_folder),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Folder:
    await _assert_unique_sibling_name(db, user, folder.parent_id, payload.name, exclude_id=folder.id)
    previous = folder.name
    folder.name = payload.name
    await log_event(
        db,
        action="FOLDER_RENAMED",
        resource_type="folder",
        resource_id=str(folder.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={"from": previous, "to": payload.name},
    )
    await db.commit()
    await db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    request: Request,
    folder: Folder = Depends(get_owned_folder),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    # Breadth-first collection of the entire subtree owned by this user.
    all_folder_ids: list[uuid.UUID] = []
    pending = [folder.id]
    while pending:
        batch = pending[:200]
        pending = pending[200:]
        all_folder_ids.extend(batch)
        children = (
            await db.execute(
                select(Folder.id).where(Folder.owner_id == user.id, Folder.parent_id.in_(batch))
            )
        ).scalars().all()
        pending.extend([child for child in children if child not in all_folder_ids])

    files = (
        await db.execute(
            select(FileRecord).where(
                FileRecord.owner_id == user.id, FileRecord.folder_id.in_(all_folder_ids)
            )
        )
    ).scalars().all()
    reclaimed = sum(file.size_bytes for file in files)

    locked_user = await db.scalar(
        select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True)
    )
    if locked_user is not None:
        locked_user.storage_used_bytes = max(0, locked_user.storage_used_bytes - reclaimed)

    from sqlalchemy import delete as sa_delete

    if files:
        await db.execute(sa_delete(FileRecord).where(FileRecord.id.in_([f.id for f in files])))
    await db.execute(sa_delete(Folder).where(Folder.id.in_(all_folder_ids), Folder.owner_id == user.id))

    await log_event(
        db,
        action="FOLDER_DELETED",
        resource_type="folder",
        resource_id=str(folder.id),
        user_id=user.id,
        ip_address=client_ip(request),
        details={"folders_deleted": len(all_folder_ids), "files_deleted": len(files), "bytes_reclaimed": reclaimed},
    )
    await db.commit()

    for file in files:
        await delete_physical(file.storage_key)
