import re
import stat
import uuid
from pathlib import Path
from urllib.parse import quote

from app.core.config import settings

# Strict UUIDv4 identifier. User input never appears in a filesystem path.
STORAGE_KEY_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


class SecurityViolationError(Exception):
    """Raised when a storage operation would escape the isolated vault."""


def get_storage_root() -> Path:
    """Return the canonical, confined vault root (never a filesystem root)."""
    root = settings.STORAGE_ROOT.resolve()
    if root == Path(root.anchor):
        raise SecurityViolationError("Storage root cannot be a filesystem root")
    root.mkdir(parents=True, exist_ok=True)
    if not root.is_dir():
        raise SecurityViolationError("Storage root is not a directory")
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


def apply_file_permissions(path: Path) -> None:
    """Owner read/write only: no execute bit for any principal."""
    path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP)  # 0o640


def safe_download_headers(display_name: str) -> dict[str, str]:
    """Force download and block inline rendering / MIME sniffing."""
    ascii_name = display_name.encode("ascii", "ignore").decode("ascii").strip() or "download"
    ascii_name = ascii_name.replace('"', "").replace("\r", "").replace("\n", "")
    return {
        "Content-Disposition": f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(display_name)}',
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
    }

