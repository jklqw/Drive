import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AdminOverview(BaseModel):
    total_users: int
    active_users: int
    total_files: int
    total_folders: int
    total_storage_bytes: int
    blocked_uploads_24h: int
    access_denied_24h: int


class AdminUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    storage_quota_bytes: int
    storage_used_bytes: int
    is_active: bool
    created_at: datetime
    file_count: int = 0


class AdminUserUpdate(BaseModel):
    storage_quota_bytes: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    ip_address: str | None
    status: str
    details: dict[str, Any]
    created_at: datetime
