import re

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def validate_display_name(value: str) -> str:
    """Reject control characters, path separators and traversal sequences."""
    value = " ".join(value.split())
    if not value:
        raise ValueError("Name cannot be empty")
    if _CONTROL_CHARS.search(value) or "\x00" in value:
        raise ValueError("Control characters are not allowed")
    if "/" in value or "\\" in value or value in {".", ".."} or ".." in value:
        raise ValueError("Path separators and traversal sequences are not allowed")
    return value
