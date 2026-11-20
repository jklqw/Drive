import re
import uuid
from pathlib import Path

from app.core.config import settings

# Strict UUIDv4 identifier. User input never appears in a filesystem path.
STORAGE_KEY_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


class SecurityViolationError(Exception):
    """Raised when a storage operation would escape the isolated vault."""


def get_storage_root() -> Path:
    root = settings.STORAGE_ROOT.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_safe_path(storage_key: str) -> Path:
    """Confine every disk operation to the vault using a canonical UUIDv4 key."""
    if not isinstance(storage_key, str) or not STORAGE_KEY_RE.fullmatch(storage_key):
        raise SecurityViolationError("Invalid storage key")
    root = get_storage_root()
    target = (root / storage_key[:2] / storage_key).resolve()
    if not target.is_relative_to(root):
        raise SecurityViolationError("Storage path escaped the vault")
    return target


def new_storage_key() -> str:
    return str(uuid.uuid4())


async def delete_physical(storage_key: str) -> None:
    resolve_safe_path(storage_key).unlink(missing_ok=True)
