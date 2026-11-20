import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    normalize_email,
    verify_password,
)
from app.core.token_store import token_store
from app.db.session import get_db
from app.models import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.audit_service import client_ip, log_event

router = APIRouter(prefix="/auth", tags=["authentication"])

REFRESH_COOKIE_NAME = "sfmp_refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"
# Verifying against a real Argon2 hash keeps the unknown-user path comparable in cost.
_DUMMY_HASH = hash_password("NotARealPassword!42")


def _set_refresh_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )


def _token_response(user_id: str) -> tuple[JSONResponse, str, str, int]:
    access = create_access_token(user_id)
    refresh, refresh_jti, max_age = create_refresh_token(user_id)
    response = JSONResponse(
        content=TokenResponse(
            access_token=access,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ).model_dump()
    )
    _set_refresh_cookie(response, refresh, max_age)
    return response, refresh, refresh_jti, max_age


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    email = normalize_email(payload.email)
    existing = await db.scalar(select(User).where(User.email == email))
    if existing is not None:
        await log_event(
            db,
            action="REGISTRATION_BLOCKED",
            resource_type="user",
            ip_address=client_ip(request),
            status="DENIED",
            details={"reason": "duplicate email"},
            commit=True,
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=UserRole.USER,
        storage_quota_bytes=settings.DEFAULT_USER_QUOTA_BYTES,
        storage_used_bytes=0,
        is_active=True,
    )
    db.add(user)
    await log_event(
        db,
        action="USER_REGISTERED",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip(request),
        details={"email": email},
    )
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    email = normalize_email(payload.email)
    user = await db.scalar(select(User).where(User.email == email))
    valid = user is not None and user.is_active and verify_password(user.password_hash, payload.password)
    if user is None:
        verify_password(_DUMMY_HASH, payload.password)
    if not valid:
        await log_event(
            db,
            action="LOGIN_FAILED",
            resource_type="user",
            user_id=user.id if user is not None else None,
            ip_address=client_ip(request),
            status="FAILED",
            details={"email": email},
            commit=True,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    response, _, _, _ = _token_response(str(user.id))
    await log_event(
        db,
        action="LOGIN_SUCCESS",
        resource_type="user",
        resource_id=str(user.id),
        user_id=user.id,
        ip_address=client_ip(request),
        commit=True,
    )
    return response


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    try:
        payload = decode_token(raw_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    if await token_store.is_revoked(payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account unavailable")

    # Rotate the refresh token: a stolen cookie cannot be replayed after use.
    old_ttl = max(int(payload["exp"]) - int(payload["iat"]), 1)
    await token_store.revoke(payload["jti"], old_ttl)
    response, _, _, _ = _token_response(str(user.id))
    await log_event(
        db,
        action="TOKEN_REFRESHED",
        resource_type="user",
        resource_id=str(user.id),
        user_id=user.id,
        ip_address=client_ip(request),
        commit=True,
    )
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token:
        try:
            payload = decode_token(raw_token, expected_type="refresh")
            ttl = max(int(payload["exp"]) - int(payload["iat"]), 1)
            await token_store.revoke(payload["jti"], ttl)
            await log_event(
                db,
                action="LOGOUT",
                resource_type="user",
                resource_id=payload["sub"],
                user_id=payload["sub"],
                ip_address=client_ip(request),
                commit=True,
            )
        except ValueError:
            pass
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    return response


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
