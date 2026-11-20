import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import validate_display_name


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    folder_id: uuid.UUID | None
    original_filename: str
    detected_mime_type: str
    extension: str
    size_bytes: int
    sha256_hash: str
    created_at: datetime
    updated_at: datetime


class FileRename(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return validate_display_name(value)
