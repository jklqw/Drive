import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from pydantic import EmailStr

from app.core.config import settings

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65_536,  # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(stored_hash: str, plain_password: str) -> bool:
    try:
        return _password_hasher.verify(stored_hash, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _create_token(subject: str, token_type: str, expires_delta: timedelta, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID | str) -> str:
    return _create_token(str(user_id), "access", timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))


def create_refresh_token(user_id: uuid.UUID | str) -> tuple[str, str, int]:
    """Return (encoded token, jti, max_age_seconds)."""
    expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token = _create_token(str(user_id), "refresh", expires)
    return token, _token_jti(token), int(expires.total_seconds())


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat", "jti", "type"]},
        )
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid or expired token") from exc
    if expected_type is not None and payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    if not isinstance(payload.get("sub"), str) or not isinstance(payload.get("jti"), str):
        raise ValueError("Malformed token claims")
    return payload


def _token_jti(token: str) -> str:
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"verify_exp": False},
    )["jti"]


def sha256_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_share_token() -> str:
    """256-bit URL-safe high entropy secret, shown to the user exactly once."""
    return secrets.token_urlsafe(32)


def normalize_email(email: EmailStr | str) -> str:
    return str(email).strip().lower()
