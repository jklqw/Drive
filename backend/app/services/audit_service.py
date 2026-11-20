import uuid
from typing import Any

from fastapi import Request
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
