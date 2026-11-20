from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.v1 import admin, auth, files, folders, shares
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import AsyncSessionLocal
from app.services.audit_service import client_ip, log_event
from app.services.storage_service import SecurityViolationError


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "0"
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        )
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(SecurityViolationError)
async def security_violation_handler(request: Request, exc: SecurityViolationError) -> JSONResponse:
    """Fail closed and record any attempt to escape the storage vault."""
    async with AsyncSessionLocal() as db:
        await log_event(
            db,
            action="PATH_TRAVERSAL_BLOCKED",
            resource_type="storage",
            resource_id=request.url.path[:255],
            ip_address=client_ip(request),
            status="DENIED",
            details={"reason": str(exc)},
            commit=True,
        )
    return JSONResponse(status_code=400, content={"detail": "Invalid storage request"})


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a uniform 429 and retain an auditable abuse signal."""
    async with AsyncSessionLocal() as db:
        await log_event(
            db,
            action="RATE_LIMIT_EXCEEDED",
            resource_type="endpoint",
            resource_id=request.url.path[:255],
            ip_address=client_ip(request),
            status="DENIED",
            details={"limit": str(exc.detail)},
            commit=True,
        )
    detail = str(exc.detail).lower()
    retry_after = "3600" if "/hour" in detail else "60"
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"},
        headers={"Retry-After": retry_after},
    )


app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(folders.router, prefix=settings.API_V1_STR)
app.include_router(files.router, prefix=settings.API_V1_STR)
app.include_router(shares.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["system"])
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "secure-file-management-platform"})
