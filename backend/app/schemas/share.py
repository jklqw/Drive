import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ShareCreateRequest(BaseModel):
    expires_in_hours: int | None = Field(default=None, ge=1, le=720)
    max_downloads: int | None = Field(default=None, ge=1, le=100_000)


class ShareResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_id: uuid.UUID
    created_by: uuid.UUID
    token_hash: str
    expires_at: datetime | None
    max_downloads: int | None
    download_count: int
    is_revoked: bool
    created_at: datetime
    filename: str | None = None


class ShareCreatedResponse(ShareResponse):
    token: str
    url: str


class PublicShareInfo(BaseModel):
    filename: str
    size_bytes: int
    detected_mime_type: str
    sha256_hash: str
    expires_at: datetime | None
    download_count: int
    max_downloads: int | None
