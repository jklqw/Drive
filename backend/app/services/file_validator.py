import re
import unicodedata
from pathlib import Path

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def safe_display_name(raw_filename: str) -> str:
    """Normalize a client filename into a safe, bounded logical display name."""
    if not raw_filename or "\x00" in raw_filename:
        raise ValueError("Invalid filename")
    name = Path(raw_filename.replace("\\", "/")).name
    name = unicodedata.normalize("NFC", name)
    name = _CONTROL_CHARS.sub("", name).strip()
    if not name or name in {".", ".."}:
        raise ValueError("Invalid filename")
    return name[:150]


def extract_extension(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")[:16]
