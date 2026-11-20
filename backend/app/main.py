from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
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

        if "Content-Security-Policy" not in response.headers:
            path = request.url.path
            api_prefix = settings.API_V1_STR.rstrip("/")
            # Strict CSP for JSON/system API endpoints and file-streaming responses.
            if path == "/health" or path == api_prefix or path.startswith(api_prefix + "/"):
                response.headers["Content-Security-Policy"] = (
                    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
                )
            else:
                # Website SPA, static assets, and API docs UI need script/style loading.
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
                    "font-src 'self' https://fonts.gstatic.com data:; "
                    "img-src 'self' data: blob:; "
                    "connect-src 'self'; "
                    "frame-ancestors 'none'; base-uri 'self'"
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


def _resolve_website_dir() -> Path | None:
    """Locate a built frontend/website bundle to serve for SPA routes.

    This is strictly separate from the isolated storage vault; user-uploaded
    objects are never exposed as static files.
    """
    configured = settings.WEBSITE_DIST_DIR
    if configured:
        candidate = Path(configured).expanduser().resolve()
        return candidate if (candidate / "index.html").is_file() else None

    repo_root = Path(__file__).resolve().parents[2]
    candidates = [
        repo_root / "frontend" / "dist",
        Path.cwd() / "frontend" / "dist",
        Path("/app/frontend/dist"),
    ]
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if (resolved / "index.html").is_file():
            return resolved
    return None


WEBSITE_DIR = _resolve_website_dir()
if WEBSITE_DIR is not None:
    assets_dir = WEBSITE_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="website-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_website(full_path: str):
        """Serve built website assets with SPA fallback, without shadowing the API."""
        normalized = full_path.lstrip("/")
        if normalized == "api" or normalized.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        if normalized:
            candidate = (WEBSITE_DIR / normalized).resolve()
            if candidate.is_file() and candidate.is_relative_to(WEBSITE_DIR):
                return FileResponse(candidate)
        index = WEBSITE_DIR / "index.html"
        return FileResponse(index)
