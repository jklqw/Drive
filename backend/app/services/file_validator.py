"""Upload filename policy: strict allowlist, never a denylist.

Only explicitly permitted extensions are accepted. Active web/script formats
are excluded by omission and are also listed explicitly for audit clarity.
"""

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
MAX_DISPLAY_NAME_LENGTH = 150

# Extension -> exact MIME types libmagic is allowed to report for that extension.
ALLOWED_MIME_BY_EXTENSION: dict[str, frozenset[str]] = {
    ".pdf": frozenset({"application/pdf"}),
    ".txt": frozenset({"text/plain"}),
    ".csv": frozenset({"text/csv", "text/plain", "application/csv"}),
    ".docx": frozenset({"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),
    ".xlsx": frozenset({"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
    ".pptx": frozenset({"application/vnd.openxmlformats-officedocument.presentationml.presentation"}),
    ".png": frozenset({"image/png"}),
    ".jpg": frozenset({"image/jpeg"}),
    ".jpeg": frozenset({"image/jpeg"}),
    ".webp": frozenset({"image/webp"}),
    ".zip": frozenset({"application/zip", "application/x-zip-compressed"}),
}

# Explicitly blocked active content. The allowlist alone already excludes these.
BLOCKED_EXTENSIONS = frozenset(
    {
        ".html", ".htm", ".shtml", ".xhtml", ".svg", ".js", ".mjs", ".jsx", ".ts", ".tsx",
        ".php", ".phtml", ".phar", ".php5", ".jsp", ".asp", ".aspx", ".cgi", ".pl", ".py",
        ".sh", ".bash", ".bat", ".cmd", ".ps1", ".exe", ".msi", ".dll", ".so", ".bin",
        ".htaccess", ".htpasswd",
    }
)


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str
    extension: str
    allowed_mimes: frozenset[str]


def safe_display_name(raw_filename: str) -> str:
    """Normalize a client filename into a safe, bounded logical display name."""
    if not raw_filename or "\x00" in raw_filename:
        raise ValueError("Invalid filename")
    name = Path(raw_filename.replace("\\", "/")).name
    name = unicodedata.normalize("NFC", name)
    name = _CONTROL_CHARS.sub("", name).strip()
    if not name or name in {".", ".."}:
        raise ValueError("Invalid filename")
    return name[:MAX_DISPLAY_NAME_LENGTH]


def extract_extension(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")[:16]


def validate_filename(raw_filename: str) -> ValidatedUpload:
    """Enforce the allowlist and return the normalized name plus expected MIME set."""
    if not isinstance(raw_filename, str) or not raw_filename or "\x00" in raw_filename:
        raise ValueError("Invalid filename")

    # Take only the final path component; never trust client-supplied paths.
    name = raw_filename.replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFC", name)
    name = _CONTROL_CHARS.sub("", name).strip()
    if not name or name in {".", ".."}:
        raise ValueError("Invalid filename")
    if len(name) > MAX_DISPLAY_NAME_LENGTH:
        raise ValueError(f"Filename exceeds {MAX_DISPLAY_NAME_LENGTH} characters")
    if "/" in name or "\\" in name:
        raise ValueError("Path separators are not allowed in filenames")

    suffixes = Path(name).suffixes
    if len(suffixes) != 1:
        raise ValueError("Only a single file extension is allowed")
    extension = suffixes[0].lower()
    if extension in BLOCKED_EXTENSIONS:
        raise ValueError(f"File type {extension} is not permitted")
    allowed = ALLOWED_MIME_BY_EXTENSION.get(extension)
    if allowed is None:
        raise ValueError(f"File type {extension} is not on the allowlist")

    return ValidatedUpload(filename=name, extension=extension.lstrip("."), allowed_mimes=allowed)
