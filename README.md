<div align="center">

# Secure File Management Platform

**A Google Drive-inspired, multi-tenant cloud storage SaaS engineered with defense-in-depth security.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-TypeScript-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Security Tested](https://img.shields.io/badge/Security-OWASP_Hardened-0F766E?style=flat-square)](./SECURITY_REPORT.md)

[Features](#core-features) • [Security Architecture](#security-controls) • [Architecture](#system-architecture) • [Quick Start](#quick-start) • [Security Report](./SECURITY_REPORT.md)

</div>

---

## Overview

Secure File Management Platform is a production-oriented cloud document workspace with multi-tenant storage, streaming uploads/downloads, expiring share links, and an admin console. It is built to demonstrate a complete secure file-handling pipeline: strict input validation, magic-byte content inspection, canonical path confinement, object-level authorization, quota enforcement, and hardened download semantics.

> **Design note:** The UI follows a Swiss-inspired SaaS aesthetic (high contrast, restrained neutrals, deliberate typography) and avoids generic AI-template styling.

## Core Features

### File & Workspace Management
- **Hierarchical folders:** Recursive folder tree, breadcrumbs, create/rename/delete with ownership checks.
- **Streaming uploads:** 64KB chunked writes, SHA-256 fingerprinting, and immediate server-side validation.
- **Streaming downloads:** Authenticated, attachment-only delivery from an isolated vault (never web-served).
- **Storage accounting:** Per-user quotas with row-locked atomic updates and reclaim on delete.
- **Share links:** High-entropy tokens stored only as SHA-256 hashes, with expiry, download caps, and revocation.
- **Admin console:** Platform overview, quota/suspension controls, and filterable audit trail.

### Security Engineering
Every control is implemented in its own commit and documented in [`SECURITY_REPORT.md`](./SECURITY_REPORT.md):

| # | Control | Implementation highlights |
|---|---|---|
| 1 | Strict extension allowlist | Allowed extensions mapped to expected MIME families; null bytes, double extensions, and active content blocked. |
| 2 | Magic-byte verification | `python-magic` inspects real content, cross-checked against extension; Pillow verifies image structure. |
| 3 | Path traversal prevention | UUIDv4-only storage keys, canonical confinement under vault root, traversal-safe display-name validation. |
| 4 | Randomized storage naming | Extensionless UUIDv4 physical keys, fully decoupled from logical filenames; SHA-256 integrity hash stored. |
| 5 | Anti-IDOR / tenant isolation | Reusable ownership dependencies (`get_owned_file/folder/share`), non-enumerable UUIDs, `404` non-leak responses + `ACCESS_DENIED` audit. |
| 6 | Size, quota, rate limiting | Nginx `client_max_body_size`, streaming byte counter, `SELECT ... FOR UPDATE` quota checks, SlowAPI + Redis limits. |
| 7 | Execution prevention | Vault outside webroot, `0640` files / `0750` dirs, `noexec,nosuid,nodev` volume, `Content-Disposition: attachment`, `nosniff`, CSP sandbox. |

## System Architecture

```text
+------------------+        HTTPS        +---------------------------+
|  React + Vite    |  <----------------> |  Nginx Reverse Proxy      |
|  (Drive/Admin/UI)|                     |  edge size limits, CSP    |
+------------------+                     +-------------+-------------+
                                                       |
                                                       | /api
                                                       v
                                            +---------------------------+
                                            |  FastAPI Backend          |
                                            |  Auth, Files, Shares,     |
                                            |  Admin, Audit, Validation |
                                            +------+------+------+------+
                                                   |      |      |
                         +-------------------------+      |      +----------------------+
                         |                                |                             |
                         v                                v                             v
              +-------------------+            +-------------------+         +----------------------+
              | PostgreSQL        |            | Redis             |         | Isolated Vault       |
              | users/folders/    |            | rate limits,      |         | /var/lib/sfmp_vault  |
              | files/shares/audit|            | token revocation  |         | (noexec, non-webroot)|
              +-------------------+            +-------------------+         +----------------------+
```

### Storage & Authorization Flow
- Logical hierarchy (folders/files) lives in PostgreSQL; physical objects live only in the isolated vault as extensionless UUIDv4 keys.
- Every resource access is scoped by `owner_id` derived from the verified JWT; foreign/missing objects return a uniform `404`.
- Public access is only via hashed share tokens with expiry/revocation/download-cap checks.

## Repository Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI routers, dependencies (ownership guards), v1 endpoints
│   │   ├── core/              # config, security, token store, rate limiter
│   │   ├── db/                # async SQLAlchemy session & base
│   │   ├── models/            # User, Folder, FileRecord, ShareLink, AuditLog
│   │   ├── schemas/           # Pydantic request/response models
│   │   └── services/          # validation, storage, audit
│   ├── migrations/            # Alembic
│   ├── scripts/seed_admin.py
│   └── tests/test_security.py # automated coverage for controls 1–7
├── frontend/                  # React 18 + TypeScript + Vite + Tailwind CSS
├── infra/nginx/default.conf
├── docker-compose.yml
├── SECURITY_REPORT.md         # consolidated control-by-control security report
└── secure_file_management_platform_guide.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL 16 |
| Cache / Limits | Redis 7, SlowAPI |
| Security libs | Argon2id (`argon2-cffi`), PyJWT, `python-magic`/libmagic, Pillow |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Axios, React Router |
| Infra | Nginx, Docker & Docker Compose, GitHub Actions CI |

## Quick Start

### Prerequisites
- Docker & Docker Compose (v2+)
- (Optional local dev) Python 3.14, Node.js 22, `libmagic`

### 1) Configure environment
```bash
cp .env.example .env
# Update JWT_SECRET_KEY, database/redis passwords, and origins for non-dev use.
```

### 2) Prepare an isolated vault host directory (for hardened bind mount)
```bash
sudo mkdir -p /var/lib/sfmp_vault
sudo chown 10001:10001 /var/lib/sfmp_vault
sudo chmod 750 /var/lib/sfmp_vault
# Optional override: export SFMP_VAULT_HOST_PATH=/path/to/vault
```

### 3) Start the stack
```bash
docker compose up --build
```
Services: frontend `http://localhost:8080`, backend `http://localhost:8000`, Postgres `5432`, Redis `6379`.

### 4) Create an administrator
```bash
docker compose exec backend python scripts/seed_admin.py \
  --email admin@example.com --password 'StrongPass!123'
```

### Local development (without full Docker stack)
Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
# requires PostgreSQL/Redis running, or adapt DATABASE_URL/REDIS_URL for dev
uvicorn app.main:app --reload --port 8000
```
Frontend:
```bash
cd frontend
npm ci
npm run dev
```

## Testing & CI

Run the automated security suite locally:
```bash
cd backend
STORAGE_ROOT=/tmp/sfmp_test_vault DATABASE_URL='sqlite+aiosqlite:///:memory:' \
  .venv/bin/python -m pytest -q
```
The suite (`backend/tests/test_security.py`) verifies all 7 controls end-to-end (allowlist, magic-byte, traversal confinement, randomized extensionless keys, anti-IDOR + audit, size/quota/rate limits, and execution-preventing headers/permissions).

CI (`.github/workflows/ci.yml`) runs backend pytest and the frontend production build on push/PR.

## API Surface (high level)

- `POST /api/v1/auth/register|login|refresh|logout`, `GET /api/v1/auth/me`
- `GET/POST /api/v1/folders`, `GET /api/v1/folders/{id}/contents`, `PATCH/DELETE /api/v1/folders/{id}`
- `POST /api/v1/files/upload`, `GET /api/v1/files/{id}/download`, `PATCH/DELETE /api/v1/files/{id}`
- `POST /api/v1/files/{id}/share`, `GET/DELETE /api/v1/shares`, `GET /api/v1/public/share/{token}[/download]`
- `GET /api/v1/admin/overview|users|audit-logs`, `PATCH /api/v1/admin/users/{id}`

Interactive docs when running locally: `http://localhost:8000/api/docs`

## Security Documentation

- **Primary report:** [`SECURITY_REPORT.md`](./SECURITY_REPORT.md) — threat vectors, defenses, and verification for controls 1–7.
- **Audit logging:** Security-relevant events (`UPLOAD_BLOCKED`, `ACCESS_DENIED`, `QUOTA_EXCEEDED`, `RATE_LIMIT_EXCEEDED`, `PATH_TRAVERSAL_BLOCKED`, etc.) are persisted for admin review.

## Notes & Limitations
- Docker daemon and live Postgres/Redis were not available in the current development environment; end-to-end verification used ASGI transport with SQLite/in-memory fallbacks and the automated pytest suite. Container screenshots are therefore not included in-repo.
- For production: set strong secrets, enable TLS termination, use managed Postgres/Redis, run migrations (`alembic upgrade head`), and provision the vault on a hardened host path with `noexec,nosuid,nodev`.

## License
Educational/portfolio project. Review and harden before any production deployment.
