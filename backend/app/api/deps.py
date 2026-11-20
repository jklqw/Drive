import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.core.token_store import token_store
from app.db.session import get_db
from app.models import FileRecord, Folder, ShareLink, User, UserRole
from app.services.audit_service import client_ip, log_event

_bearer = HTTPBearer(auto_error=False)

NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if await token_store.is_revoked(payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account unavailable")

    # Exposed to the rate-limit key function without ever trusting client input.
    request.state.user_id = str(user.id)
    return user


async def require_admin(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if user.role != UserRole.ADMIN:
        await log_event(
            db,
            action="ACCESS_DENIED",
            resource_type="admin_console",
            resource_id=request.url.path[:255],
            user_id=user.id,
            ip_address=client_ip(request),
            status="DENIED",
            details={"reason": "administrator role required"},
            commit=True,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user


async def get_owned_file(
    file_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileRecord:
    result = await db.execute(
        select(FileRecord).where(FileRecord.id == file_id, FileRecord.owner_id == user.id)
    )
    file_record = result.scalar_one_or_none()
    if file_record is None:
        # Identical 404 for foreign and nonexistent resources; no existence leak.
        await log_event(
            db,
            action="ACCESS_DENIED",
            resource_type="file",
            resource_id=str(file_id),
            user_id=user.id,
            ip_address=client_ip(request),
            status="DENIED",
            details={"reason": "object not owned by requester"},
            commit=True,
        )
        raise NOT_FOUND
    return file_record


async def get_owned_folder(
    folder_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Folder:
    result = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.owner_id == user.id))
    folder = result.scalar_one_or_none()
    if folder is None:
        await log_event(
            db,
            action="ACCESS_DENIED",
            resource_type="folder",
            resource_id=str(folder_id),
            user_id=user.id,
            ip_address=client_ip(request),
            status="DENIED",
            details={"reason": "object not owned by requester"},
            commit=True,
        )
        raise NOT_FOUND
    return folder


async def get_owned_share(
    share_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareLink:
    """Reusable object-level guard for every share-management operation."""
    share = await db.scalar(
        select(ShareLink).where(ShareLink.id == share_id, ShareLink.created_by == user.id)
    )
    if share is None:
        await log_event(
            db,
            action="ACCESS_DENIED",
            resource_type="share",
            resource_id=str(share_id),
            user_id=user.id,
            ip_address=client_ip(request),
            status="DENIED",
            details={"reason": "object not owned by requester"},
            commit=True,
        )
        raise NOT_FOUND
    return share
