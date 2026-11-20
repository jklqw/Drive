import re
import unicodedata

MAX_DISPLAY_NAME_LENGTH = 150
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_WINDOWS_RESERVED = re.compile(
    r"^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$",
    re.IGNORECASE,
)


def validate_display_name(value: str) -> str:
    """Reject control characters, path separators and traversal sequences.

    Display names are logical metadata only, but they are still normalized and
    constrained so no downstream component can reinterpret them as a path.
    """
    if not isinstance(value, str):
        raise ValueError("Name must be text")
    value = unicodedata.normalize("NFC", " ".join(value.split()))
    if not value:
        raise ValueError("Name cannot be empty")
    if len(value) > MAX_DISPLAY_NAME_LENGTH:
        raise ValueError(f"Name exceeds {MAX_DISPLAY_NAME_LENGTH} characters")
    if _CONTROL_CHARS.search(value) or "\x00" in value:
        raise ValueError("Control characters are not allowed")
    if "/" in value or "\\" in value or value in {".", ".."} or ".." in value:
        raise ValueError("Path separators and traversal sequences are not allowed")
    if value != value.rstrip(" ."):
        raise ValueError("Trailing dots and spaces are not allowed")
    if re.match(r"^[A-Za-z]:", value):
        raise ValueError("Drive prefixes are not allowed")
    if _WINDOWS_RESERVED.fullmatch(value):
        raise ValueError("Reserved device names are not allowed")
    return value
