import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models import FileRecord, Folder, User
from app.schemas.admin import AdminOverview, AdminUser, AdminUserUpdate, AuditLogResponse
from app.services.audit_service import client_ip, count_events, list_events, log_event

router = APIRouter(prefix="/admin", tags=["administration"])

BLOCKED_ACTIONS = [
    "UPLOAD_BLOCKED",
    "LOGIN_FAILED",
    "REGISTRATION_BLOCKED",
    "QUOTA_EXCEEDED",
    "RATE_LIMIT_EXCEEDED",
]


@router.get("/overview", response_model=AdminOverview)
async def overview(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminOverview:
    total_users = int(await db.scalar(select(func.count(User.id))) or 0)
    active_users = int(await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0)
    total_files = int(await db.scalar(select(func.count(FileRecord.id))) or 0)
    total_folders = int(await db.scalar(select(func.count(Folder.id))) or 0)
    total_storage = int(await db.scalar(select(func.coalesce(func.sum(User.storage_used_bytes), 0))) or 0)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    blocked = await count_events(db, BLOCKED_ACTIONS, since)
    denied = await count_events(db, ["ACCESS_DENIED"], since)
    return AdminOverview(
        total_users=total_users,
        active_users=active_users,
        total_files=total_files,
        total_folders=total_folders,
        total_storage_bytes=total_storage,
        blocked_uploads_24h=blocked,
        access_denied_24h=denied,
    )


@router.get("/users", response_model=list[AdminUser])
async def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUser]:
    rows = (
        await db.execute(
            select(User, func.count(FileRecord.id).label("file_count"))
            .outerjoin(FileRecord, FileRecord.owner_id == User.id)
            .group_by(User.id)
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()
    return [AdminUser.model_validate(row[0]).model_copy(update={"file_count": row[1]}) for row in rows]


@router.patch("/users/{user_id}", response_model=AdminUser)
async def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.storage_quota_bytes is not None:
        if payload.storage_quota_bytes < target.storage_used_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quota cannot be lower than the storage already used",
            )
        target.storage_quota_bytes = payload.storage_quota_bytes
    if payload.is_active is not None:
        if target.id == admin.id and not payload.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot suspend your own account")
        target.is_active = payload.is_active

    await log_event(
        db,
        action="ADMIN_USER_UPDATED",
        resource_type="user",
        resource_id=str(target.id),
        user_id=admin.id,
        ip_address=client_ip(request),
        details=payload.model_dump(exclude_none=True),
    )
    await db.commit()
    await db.refresh(target)
    count = int(await db.scalar(select(func.count(FileRecord.id)).where(FileRecord.owner_id == target.id)) or 0)
    return AdminUser.model_validate(target).model_copy(update={"file_count": count})


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def audit_logs(
    action: str | None = Query(default=None, max_length=64),
    status_filter: str | None = Query(default=None, alias="status", max_length=16),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogResponse]:
    events = await list_events(db, action=action, status=status_filter, skip=skip, limit=limit)
    return [AuditLogResponse.model_validate(event) for event in events]
