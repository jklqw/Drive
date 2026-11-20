"""Regression tests for the seven documented security controls.

The suite exercises real ASGI endpoints against an in-memory SQLite database and
an isolated temporary vault so every control is verified end to end.
"""

import io
import uuid

import pytest
from PIL import Image
from sqlalchemy import func, select, update

from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import AsyncSessionLocal
from app.models import AuditLog, FileRecord, User
from app.schemas.common import validate_display_name
from app.services.storage_service import (
    SecurityViolationError,
    STORAGE_KEY_RE,
    get_storage_root,
    resolve_safe_path,
)

PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


async def make_user(client, email: str, password: str = "StrongPass!123") -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": email.split("@")[0].title(), "password": password},
    )
    assert response.status_code == 201, response.text
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}}


def png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (2, 2), (15, 60, 120)).save(buffer, format="PNG")
    return buffer.getvalue()


async def audit_count(action: str) -> int:
    async with AsyncSessionLocal() as db:
        return int(
            await db.scalar(
                select(func.count()).select_from(AuditLog).where(AuditLog.action == action)
            )
            or 0
        )


# ---------------------------------------------------------------------------
# Control 1 — Extension allowlist & filename sanitization
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "filename",
    ["shell.php", "payload.svg", "exploit.html", "invoice.pdf.exe", "script.js"],
)
async def test_control1_rejects_disallowed_extensions(client, filename):
    user = await make_user(client, f"{filename.replace('.', '')}@example.com")
    response = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": (filename, b"payload", "application/octet-stream")},
    )
    assert response.status_code in (400, 415)
    assert await audit_count("UPLOAD_BLOCKED") >= 1


def test_control1_validator_rejects_null_bytes_and_double_extensions():
    from app.services.file_validator import validate_filename

    for bad in ["x\x00.txt", "invoice.pdf.exe", "exploit.html", "CON.txt"]:
        with pytest.raises(ValueError):
            validate_filename(bad)


async def test_control1_accepts_allowlisted_extension(client):
    user = await make_user(client, "allowed@example.com")
    response = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("notes.txt", b"hello world", "text/plain")},
    )
    assert response.status_code == 201
    assert response.json()["original_filename"] == "notes.txt"


# ---------------------------------------------------------------------------
# Control 2 — Magic-byte MIME content verification
# ---------------------------------------------------------------------------

async def test_control2_rejects_script_renamed_to_png(client):
    user = await make_user(client, "mime@example.com")
    response = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("avatar.png", b"<?php system($_GET['c']); ?>", "image/png")},
    )
    assert response.status_code == 415
    assert await audit_count("UPLOAD_BLOCKED") == 1


async def test_control2_trusts_detected_mime_not_client_header(client):
    user = await make_user(client, "mime2@example.com")
    response = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("pixel.png", png_bytes(), "text/plain")},
    )
    assert response.status_code == 201
    assert response.json()["detected_mime_type"] == "image/png"


# ---------------------------------------------------------------------------
# Control 3 — Path traversal prevention
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "name",
    ["../../etc/passwd", r"..\secret.txt", "..", "C:windows\\system32", "CON", "report.txt."],
)
async def test_control3_logical_names_reject_traversal(name):
    with pytest.raises(ValueError):
        validate_display_name(name)


async def test_control3_storage_keys_are_confined():
    root = get_storage_root().resolve()
    valid_key = str(uuid.uuid4())
    target = resolve_safe_path(valid_key)
    assert target.is_relative_to(root)
    assert STORAGE_KEY_RE.fullmatch(valid_key)

    for bad in ["../../etc/passwd", "not-a-uuid", valid_key.upper(), "../" + valid_key]:
        with pytest.raises(SecurityViolationError):
            resolve_safe_path(bad)


# ---------------------------------------------------------------------------
# Control 4 — Extensionless UUIDv4 physical storage names
# ---------------------------------------------------------------------------

async def test_control4_duplicate_display_names_store_distinct_extensionless_keys(client):
    user = await make_user(client, "randomnames@example.com")
    for _ in range(2):
        response = await client.post(
            "/api/v1/files/upload",
            headers=user["headers"],
            files={"file": ("quarterly-report.pdf", PDF, "application/pdf")},
        )
        assert response.status_code == 201

    async with AsyncSessionLocal() as db:
        keys = (await db.execute(select(FileRecord.storage_key))).scalars().all()
    assert len(keys) == 2
    assert len(set(keys)) == 2

    for key in keys:
        assert STORAGE_KEY_RE.fullmatch(key)
        path = resolve_safe_path(key)
        assert path.suffix == ""
        assert path.is_file()
        assert path.stat().st_mode & 0o777 == 0o640


# ---------------------------------------------------------------------------
# Control 5 — Object-level authorization (anti-IDOR)
# ---------------------------------------------------------------------------

async def test_control5_cross_tenant_requests_are_denied_and_audited(client):
    owner = await make_user(client, "owner@example.com")
    attacker = await make_user(client, "attacker@example.com")

    folder = (
        await client.post(
            "/api/v1/folders", headers=owner["headers"], json={"name": "Private"}
        )
    ).json()
    file = (
        await client.post(
            "/api/v1/files/upload",
            headers=owner["headers"],
            files={"file": ("secret.pdf", PDF, "application/pdf")},
            data={"folder_id": folder["id"]},
        )
    ).json()
    share = (
        await client.post(
            f"/api/v1/files/{file['id']}/share",
            headers=owner["headers"],
            json={"expires_in_hours": 24},
        )
    ).json()

    probes = [
        ("GET", f"/api/v1/folders/{folder['id']}/contents", None),
        ("PATCH", f"/api/v1/folders/{folder['id']}", {"name": "Stolen"}),
        ("DELETE", f"/api/v1/folders/{folder['id']}", None),
        ("GET", f"/api/v1/files/{file['id']}/download", None),
        ("PATCH", f"/api/v1/files/{file['id']}", {"name": "Stolen.pdf"}),
        ("DELETE", f"/api/v1/files/{file['id']}", None),
        ("POST", f"/api/v1/files/{file['id']}/share", {"expires_in_hours": 24}),
        ("DELETE", f"/api/v1/shares/{share['id']}", None),
    ]
    for method, path, body in probes:
        response = await client.request(method, path, headers=attacker["headers"], json=body)
        assert response.status_code == 404, (method, path, response.text)

    admin_probe = await client.get("/api/v1/admin/overview", headers=attacker["headers"])
    assert admin_probe.status_code == 403
    assert await audit_count("ACCESS_DENIED") == len(probes) + 1

    owner_view = await client.get(
        f"/api/v1/folders/{folder['id']}/contents", headers=owner["headers"]
    )
    assert owner_view.status_code == 200
    assert owner_view.json()["files"][0]["id"] == file["id"]


# ---------------------------------------------------------------------------
# Control 6 — Size caps, atomic quotas and rate limiting
# ---------------------------------------------------------------------------

async def test_control6_oversized_stream_is_rejected(client, monkeypatch):
    user = await make_user(client, "size@example.com")
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_BYTES", 32)
    response = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("large.txt", b"x" * 33, "text/plain")},
    )
    assert response.status_code == 413
    assert await audit_count("UPLOAD_BLOCKED") == 1


async def test_control6_storage_quota_is_enforced(client):
    user = await make_user(client, "quota@example.com")
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(User).where(User.email == "quota@example.com").values(storage_quota_bytes=4)
        )
        await db.commit()
    response = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("over.txt", b"hello!", "text/plain")},
    )
    assert response.status_code == 413
    assert await audit_count("QUOTA_EXCEEDED") == 1


async def test_control6_login_is_rate_limited(client):
    limiter.reset()
    for _ in range(5):
        response = await client.post(
            "/api/v1/auth/login", json={"email": "brute@example.com", "password": "WrongPass!123"}
        )
        assert response.status_code == 401
    blocked = await client.post(
        "/api/v1/auth/login", json={"email": "brute@example.com", "password": "WrongPass!123"}
    )
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"] == "60"
    assert await audit_count("RATE_LIMIT_EXCEEDED") == 1


# ---------------------------------------------------------------------------
# Control 7 — Execution prevention & safe downloads
# ---------------------------------------------------------------------------

async def test_control7_download_headers_and_permissions(client):
    user = await make_user(client, "execute@example.com")
    uploaded = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("report.txt", b"safe content", "text/plain")},
    )
    file_id = uploaded.json()["id"]
    download = await client.get(f"/api/v1/files/{file_id}/download", headers=user["headers"])

    assert download.headers["content-disposition"].startswith("attachment;")
    assert "report.txt" in download.headers["content-disposition"]
    assert download.headers["x-content-type-options"] == "nosniff"
    assert download.headers["content-security-policy"] == "default-src 'none'; sandbox"
    assert download.headers["cache-control"] == "private, no-store"

    async with AsyncSessionLocal() as db:
        key = (await db.scalar(select(FileRecord.storage_key).where(FileRecord.id == uuid.UUID(file_id))))
    path = resolve_safe_path(key)
    assert path.stat().st_mode & 0o777 == 0o640
    assert path.parent.stat().st_mode & 0o777 == 0o750

    health = await client.get("/health")
    assert health.headers["x-frame-options"] == "DENY"
    assert health.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "default-src 'none'" in health.headers["content-security-policy"]


async def test_control7_public_share_download_is_also_an_attachment(client):
    user = await make_user(client, "public@example.com")
    uploaded = await client.post(
        "/api/v1/files/upload",
        headers=user["headers"],
        files={"file": ("shared.txt", b"shared bytes", "text/plain")},
    )
    share = await client.post(
        f"/api/v1/files/{uploaded.json()['id']}/share",
        headers=user["headers"],
        json={"expires_in_hours": 24, "max_downloads": 1},
    )
    token = share.json()["token"]
    download = await client.get(f"/api/v1/public/share/{token}/download")
    assert download.status_code == 200
    assert download.headers["content-disposition"].startswith("attachment;")
    assert download.headers["content-security-policy"] == "default-src 'none'; sandbox"
    second = await client.get(f"/api/v1/public/share/{token}/download")
    assert second.status_code == 410
