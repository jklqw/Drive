import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    if request.client:
        return request.client.host[:64]
    return None


async def log_event(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    user_id: uuid.UUID | str | None = None,
    ip_address: str | None = None,
    status: str = "SUCCESS",
    details: dict[str, Any] | None = None,
    commit: bool = False,
) -> AuditLog:
    """Append a security event. Commit only for paths that have no outer transaction."""
    entry = AuditLog(
        user_id=uuid.UUID(str(user_id)) if user_id is not None else None,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        ip_address=ip_address,
        status=status,
        details=details or {},
    )
    db.add(entry)
    if commit:
        await db.commit()
    return entry


async def count_events(db: AsyncSession, actions: list[str], since: datetime) -> int:
    """Count audit events for the given actions since a UTC timestamp."""
    value = await db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.action.in_(actions),
            AuditLog.created_at >= since.replace(tzinfo=None),
        )
    )
    return int(value or 0)


async def list_events(
    db: AsyncSession,
    *,
    action: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[AuditLog]:
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
    if status:
        query = query.where(AuditLog.status == status)
    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    return list((await db.execute(query)).scalars().all())
