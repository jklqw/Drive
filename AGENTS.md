# AGENTS.md — Agent Working Memory & Execution State

**Project:** Secure File Management Platform (Google Drive-inspired Cloud Storage SaaS)  
**Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)  
**Workspace:** `/home/vbnm/Drive`  
**Current Date:** 2026-11-20  

---

## 1. Project Goal & Overview
Design, build, verify, and document a production-grade, Google Drive-inspired cloud file management platform engineered with defense-in-depth security, strict multi-tenant access control, clean Git commit history, and a modern SaaS interface (Swiss design palette, zero AI clichés).

Key capabilities:
- User authentication & session management (Argon2id, short-lived JWT, HttpOnly refresh cookies, Redis revocation).
- Multi-tenant cloud storage engine with hierarchical folders, breadcrumb navigation, and recursive deletion.
- Streaming chunked uploads (64KB chunks) with on-the-fly SHA-256 fingerprinting and atomic storage quota accounting.
- Expiring, rate-limited public share links with SHA-256 hashed secret tokens and download caps.
- Admin console with storage analytics, quota modifications, account suspension, and real-time security audit trails.
- 7 dedicated security controls (allowlist, magic-byte inspection, path traversal confinement, UUIDv4 extensionless storage keys, anti-IDOR object-level authorization, DoS/quota/rate limiting, and execution prevention with CSP/attachment headers).

---

## 2. Technical Stack Specification
| Component | Technology | Rationale / Configuration |
| :--- | :--- | :--- |
| **Backend** | Python 3.14 + FastAPI + Pydantic v2 | High-performance async I/O, strict schema validation, dependency injection |
| **Database** | PostgreSQL 16 + Async SQLAlchemy 2.0 + Alembic | Relational integrity, row locking (`FOR UPDATE`) for quotas, native UUIDs |
| **Cache & Limiting** | Redis 7 + SlowAPI | Distributed token denylist, sliding-window rate limiting |
| **MIME Inspection** | python-magic (`libmagic 5.46`) + Pillow | True binary header inspection, image structure verification |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Fast SPA, type-safe API client, drag-and-drop, clean Swiss utility UI |
| **Proxy / Web Server**| Nginx 1.25+ | Edge file size limits (25MB), isolation outside webroot, security headers |
| **Orchestration** | Docker & Docker Compose | Isolated services, non-root storage volume at `/var/lib/sfmp_vault` |

---

## 3. Commit-by-Commit Roadmap & Status Checklist

### Phase 1: Repository Initialization & Scaffolding
- [x] **Commit 1:** `chore: initialize repository structure, gitignore, and environment template`
- [x] **Commit 2:** `chore(backend): configure FastAPI dependencies, requirements.txt, and settings`
- [x] **Commit 3:** `chore(frontend): scaffold React TypeScript workspace with Tailwind CSS`
- [x] **Commit 4:** `chore(infra): add Docker Compose for PostgreSQL, Redis, and isolated storage volume`

### Phase 2: Database Modeling & Authentication
- [x] **Commit 5:** `feat(db): design async SQLAlchemy models and initial Alembic migration`
- [x] **Commit 6:** `feat(auth): implement Argon2id hashing, JWT sessions, and HttpOnly refresh cookies`
- [x] **Commit 7:** `ui(auth): build clean login and registration pages with token refresh interceptor`

### Phase 3: Core Cloud Drive Engine
- [x] **Commit 8:** `feat(folders): implement hierarchical folder CRUD, breadcrumbs, and recursive delete`
- [x] **Commit 9:** `feat(files): implement chunked file upload, streaming download, rename, and delete`
- [x] **Commit 10:** `feat(sharing): add expiring tokenized file sharing with hashed tokens and download caps`
- [x] **Commit 11:** `feat(admin): add admin dashboard API for user quotas, storage metrics, and audit logs`

### Phase 4: Handcrafted Modern Frontend
- [x] **Commit 12:** `ui(layout): build refined SaaS workspace shell with sidebar and storage quota meter`
- [x] **Commit 13:** `ui(files): implement drag-and-drop uploader, grid/list file explorer, and inspector drawer`
- [x] **Commit 14:** `ui(sharing): add share link management modal and clean public download view`
- [x] **Commit 15:** `ui(admin): build admin console for storage analytics, user quotas, and security logs`

### Phase 5: Security Hardening (Dedicated Commits + SECURITY_REPORT.md Updates)
- [x] **Commit 16:** `sec(upload): enforce strict file extension allowlist and filename sanitization` (Control #1)
- [x] **Commit 17:** `sec(validation): implement magic-byte MIME content verification with python-magic` (Control #2)
- [x] **Commit 18:** `sec(storage): prevent path traversal via canonical path confinement and strict key regex` (Control #3)
- [x] **Commit 19:** `sec(storage): decouple display names using extensionless UUIDv4 randomized filenames` (Control #4)
- [x] **Commit 20:** `sec(access-control): enforce strict object-level ownership guards across all endpoints` (Control #5)
- [x] **Commit 21:** `sec(dos): enforce streaming file size caps, atomic quotas, and Redis rate limiting` (Control #6)
- [x] **Commit 22:** `sec(execution): harden storage isolation, permissions, CSP sandbox, and download headers` (Control #7)

### Phase 6: Security Testing & Portfolio Polish
- [x] **Commit 23:** `test(security): add automated pytest suite covering all 7 security controls and CI workflow`
- [x] **Commit 24:** `docs: add polished GitHub README with architecture, security overview, and screenshots`

---

## 4. Development Environment Details & Ports
- **PostgreSQL Port:** 5432 (default DB: `sfmp_db`, user: `sfmp_user`, password: `sfmp_dev_password`)
- **Redis Port:** 6379 (password: `redis_dev_password`)
- **Backend API Port:** 8000
- **Frontend Vite Port:** 5173
- **Nginx Reverse Proxy Port:** 8080 (serves frontend, proxies `/api` to backend)
- **Isolated Storage Root:** `/var/lib/sfmp_vault` (in Docker) or `./storage_vault` (local dev fallback)

---

## 5. Chronological Event & Memory Log
- **2026-11-20 11:30** — Initial analysis of `secure_file_management_platform_guide.md`.
- **2026-11-20 11:45** — Environment discovery completed (Python 3.14, Node 22, Docker 29, Compose v5, Fedora 43, libmagic.so.1 present).
- **2026-11-20 11:46** — Initialized `AGENTS.md` memory log. Commencing Phase 1.
- **2026-11-20 12:20** — Completed roadmap commits 1-24 on `main`: DB/auth/folders/files/sharing/admin APIs, React UI (layout/explorer/sharing/admin), all 7 security controls with `SECURITY_REPORT.md` sections, automated security suite, and README/docs. Verification: backend security tests 23 passed (ASGI+SQLite, isolated temp vault) and frontend `npm run build` passed; Docker/Postgres/Redis unavailable locally.
- **2026-11-20 12:40** — Pushed roadmap commits and added `f1c305b` `feat(website): serve built SPA from backend and add missing modal component` (backend SPA serving via `WEBSITE_DIST_DIR`/auto-detected `frontend/dist`, SPA fallback without shadowing `/api`, tracked `frontend/src/components/ui/Modal.tsx`).
- **2026-11-20 13:00** — Updated markdown docs: added website frontend guide and SPA delivery/deployment/security notes to `README.md` and `SECURITY_REPORT.md`; cleaned `WEBSITE_DIST_DIR` config; updated `AGENTS.md`.
