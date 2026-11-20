import re
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def validate_display_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Name cannot be empty")
    if _CONTROL_CHARS.search(value) or "\x00" in value:
        raise ValueError("Control characters are not allowed")
    if "/" in value or "\\" in value or value in {".", ".."} or ".." in value:
        raise ValueError("Path separators and traversal sequences are not allowed")
    return value


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    parent_id: uuid.UUID | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return validate_display_name(value)


class FolderRename(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return validate_display_name(value)


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    parent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class BreadcrumbItem(BaseModel):
    id: uuid.UUID | None
    name: str


class ContentsResponse(BaseModel):
    folders: list[FolderResponse]
    files: list[dict[str, Any]]
    breadcrumbs: list[BreadcrumbItem]
