<div align="center">

# Secure File Management Platform

**A Google Drive-inspired, multi-tenant cloud storage SaaS engineered with defense-in-depth security.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-TypeScript-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Security Tested](https://img.shields.io/badge/Security-OWASP_Hardened-0F766E?style=flat-square)](./SECURITY_REPORT.md)

[Features](#core-features) • [Security Architecture](#security-controls) • [Architecture](#system-architecture) • [Website Frontend Guide](#website-frontend-guide) • [Quick Start](#quick-start) • [Security Report](./SECURITY_REPORT.md)

</div>

---

## Overview

Secure File Management Platform is a production-oriented cloud document workspace with multi-tenant storage, streaming uploads/downloads, expiring share links, and an admin console. It includes a React web frontend (Drive, sharing, admin, and public download views) and a FastAPI backend that can serve the built website bundle for single-origin deployments. It is built to demonstrate a complete secure file-handling pipeline: strict input validation, magic-byte content inspection, canonical path confinement, object-level authorization, quota enforcement, and hardened download semantics.

> **Design note:** The UI follows a Swiss-inspired SaaS aesthetic (high contrast, restrained neutrals, deliberate typography) and avoids generic AI-template styling.

## Core Features

### File & Workspace Management
- **Hierarchical folders:** Recursive folder tree, breadcrumbs, create/rename/delete with ownership checks.
- **Streaming uploads:** 64KB chunked writes, SHA-256 fingerprinting, and immediate server-side validation.
- **Streaming downloads:** Authenticated, attachment-only delivery from an isolated vault (never web-served).
- **Storage accounting:** Per-user quotas with row-locked atomic updates and reclaim on delete.
- **Share links:** High-entropy tokens stored only as SHA-256 hashes, with expiry, download caps, and revocation.
- **Admin console:** Platform overview, quota/suspension controls, and filterable audit trail.

### Website Frontend
- **React SPA:** Login/register, Drive workspace (upload/drag-drop, grid/list, breadcrumbs, inspector), sharing management, admin console, and public share download views.
- **API integration:** Axios client with access-token refresh interceptor; protected/public routes via React Router.
- **Deployment modes:** Served by Nginx in Docker Compose, or directly by the FastAPI backend from a built `frontend/dist` bundle (SPA fallback) for single-origin setups. User-uploaded vault objects are never served as static website files.

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
Docker (default):                         Single-origin (backend-served SPA):
+------------------+   HTTPS   +---------------------------+
|  React + Vite    | <-------> |  Nginx Reverse Proxy      |
|  (built SPA)     |           |  serves site, proxies /api|
+------------------+           +-------------+-------------+
                                             |
                                             | /api
                                             v
+---------------------------+       +---------------------------+
|  Browser (SPA routes)     | ----> |  FastAPI Backend          |
|  /, /drive, /admin, ...   |       |  API + optional SPA serve |
+---------------------------+       |  (trusted built dist only)|
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

Note: uploaded user files are never served from the website/static bundle; downloads always stream
through authenticated or token-authorized API endpoints from the isolated vault.
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
├── frontend/                  # React 18 + TypeScript + Vite + Tailwind CSS (website SPA)
│   ├── src/                   # pages, components, routes, API client, auth context
│   └── dist/                  # production build output (gitignored; served by Nginx or backend)
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
| Frontend (website) | React 18, TypeScript, Vite, Tailwind CSS, Axios, React Router, Lucide icons |
| Infra | Nginx, Docker & Docker Compose, GitHub Actions CI |

## Website Frontend Guide

The web frontend is a React 18 + TypeScript single-page application (Vite + Tailwind CSS) that provides the user-facing experience for authentication, Drive workspace management, sharing, public downloads, and administration.

### Frontend structure & routes
- **Stack:** React 18, TypeScript, Vite, Tailwind CSS, Axios, React Router, Lucide icons.
- **Source:** `frontend/src/` (pages, components, layout, API client/services, auth/context, route guards).
- **Key UI areas:**
  - **Auth:** login and registration (`/login`, `/register`) with token refresh handling.
  - **Drive workspace:** folder tree/breadcrumbs, grid/list file explorer, drag-and-drop upload, inspector/details actions.
  - **Sharing:** create/revoke/manage expiring share links and a public share/download view (`/share/:token`).
  - **Admin:** storage/usage overview, user quota/suspension controls, and audit log views (admin-only).

### Run the frontend in development
```bash
cd frontend
npm ci
npm run dev
```
- Vite dev server runs on `http://localhost:5173` by default.
- Configure the API base URL/origin as required by `frontend` environment/config (e.g. `.env`/Vite env such as `VITE_API_BASE_URL`) so requests reach the backend (`http://localhost:8000`) with CORS allowed.

### Build for production
```bash
cd frontend
npm ci
npm run build
```
- Output is written to `frontend/dist/` (gitignored). This directory contains the static website bundle (`index.html`, hashed assets under `assets/`, etc.).

### Deployment modes
1. **Docker Compose + Nginx (default):** Nginx serves the built frontend and proxies `/api` to the FastAPI backend (see `infra/nginx/default.conf`, exposed on `http://localhost:8080`). Edge controls such as `client_max_body_size` and proxy/security headers are enforced at Nginx.
2. **Backend-served SPA (single-origin):** The FastAPI backend can serve a trusted built bundle for SPA routes.
   - Auto-detected locations (when `index.html` exists): `<repo>/frontend/dist`, `<cwd>/frontend/dist`, `/app/frontend/dist`.
   - Override with `WEBSITE_DIST_DIR=/absolute/path/to/dist`.
   - Behavior: mounts `/assets` if present, serves existing files from the dist directory, and falls back to `index.html` for non-API routes; `/api/*` is never shadowed by the SPA handler.
   - Use this mode by building the frontend and running the backend with access to the `dist` directory (or setting `WEBSITE_DIST_DIR`).

### Security notes for website delivery
- The website bundle is **separate from the storage vault**. User-uploaded files are never exposed as static assets and are only delivered via authenticated or token-authorized streaming API endpoints.
- SPA fallback serves files only from the resolved, trusted dist directory (path confinement prevents escaping that directory). Do not point `WEBSITE_DIST_DIR` at untrusted or sensitive locations.
- In Nginx deployments, frontend and API security headers/CSP are applied per location as configured. When the backend serves the SPA directly, FastAPI security middleware applies to responses (including a strict default CSP for API-hardening); verify CSP/header behavior fits browser asset loading needs for your deployment and adjust deliberately if required.

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
Frontend (separate dev server):
```bash
cd frontend
npm ci
npm run dev
```

Backend-served website (single-origin local):
```bash
cd frontend && npm ci && npm run build
cd ../backend
# ensure frontend/dist exists or set WEBSITE_DIST_DIR=/absolute/path/to/frontend/dist
uvicorn app.main:app --reload --port 8000
# open http://localhost:8000 (SPA routes) and http://localhost:8000/api/docs
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
- The built frontend bundle (`frontend/dist/`) is not committed; build it with `npm run build` for backend-served SPA or image builds that expect it.
- For production: set strong secrets, enable TLS termination, use managed Postgres/Redis, run migrations (`alembic upgrade head`), and provision the vault on a hardened host path with `noexec,nosuid,nodev`. Confirm website delivery headers/CSP match your chosen serving mode (Nginx vs backend-served SPA).

## License
Educational/portfolio project. Review and harden before any production deployment.
