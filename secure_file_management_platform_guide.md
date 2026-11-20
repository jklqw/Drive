# Secure-File-Management-Platform: Complete Engineering & Security Playbook

> **Project Goal:** Design and build a production-grade, Google Drive–inspired cloud file management platform engineered with defense-in-depth security, strict access control, clean Git history, and a refined modern SaaS interface.
>
> **What Employers See:** You didn't just build a basic file upload form—you architected an isolated, multi-tenant document management platform featuring object-level authorization, cryptographic storage decoupling, magic-byte inspection, quota enforcement, rate limiting, and formal security documentation.

---

## Table of Contents

1. [Recommended Tech Stack & Architecture](#1-recommended-tech-stack--architecture)
2. [UI/UX Design Direction (Modern SaaS — Zero "AI Clichés")](#2-uiux-design-direction-modern-saas--zero-ai-clichés)
3. [Target Repository Structure](#3-target-repository-structure)
4. [Prerequisites & Local Tool Installation](#4-prerequisites--local-tool-installation)
5. [Commit-by-Commit Development Roadmap](#5-commit-by-commit-development-roadmap)
   - [Phase 1: Repository Initialization & Scaffolding](#phase-1-repository-initialization--scaffolding)
   - [Phase 2: Database Modeling & Authentication](#phase-2-database-modeling--authentication)
   - [Phase 3: Core Cloud Drive Engine](#phase-3-core-cloud-drive-engine)
   - [Phase 4: Handcrafted Modern Frontend](#phase-4-handcrafted-modern-frontend)
   - [Phase 5: Security Hardening (Separate Commits + Report Updates)](#phase-5-security-hardening-separate-commits--report-updates)
   - [Phase 6: Security Testing & Portfolio Polish](#phase-6-security-testing--portfolio-polish)
6. [Ready-to-Use Repository Files](#6-ready-to-use-repository-files)
   - [A. `requirements.txt` & `requirements-dev.txt`](#a-requirementstxt--requirements-devtxt)
   - [B. Portfolio-Ready `README.md` Template](#b-portfolio-ready-readmemd-template)
   - [C. Consolidated `SECURITY_REPORT.md` (All 7 Security Domains)](#c-consolidated-security_reportmd-all-7-security-domains)
7. [Git Best Practices & Interview Talking Points](#7-git-best-practices--interview-talking-points)

---

## 1. Recommended Tech Stack & Architecture

To achieve optimal performance, strong security primitives, and clean maintainability—while adhering to standard Python repository conventions (`requirements.txt`, `README.md`)—use the following stack:

### Core Languages & Frameworks
| Layer | Technology | Why It Is Optimal for This Project |
| :--- | :--- | :--- |
| **Backend Language** | **Python 3.12+** | Clean security ecosystem, strong typing support, async I/O performance. |
| **Backend Framework** | **FastAPI** | High-throughput async file streaming, strict Pydantic v2 validation, automatic OpenAPI docs, dependency injection for auth/RBAC. |
| **Database** | **PostgreSQL 16** | ACID transactions for quota accounting, relational integrity for folders/permissions, `UUID` native type. |
| **ORM & Migrations** | **SQLAlchemy 2.0 (Async) + Alembic** | Parameterized queries (SQLi immunity), schema version control. |
| **Cache & Rate Limiting** | **Redis 7 + SlowAPI** | Distributed sliding-window rate limits for uploads/logins and token revocation lists. |
| **File Inspection** | **python-magic (`libmagic`)** | Inspects binary file headers (magic bytes) to verify true MIME types beyond spoofable extensions. |
| **Authentication** | **Argon2id (`argon2-cffi`) + PyJWT** | Memory-hard password hashing + short-lived access tokens & `HttpOnly` refresh cookies. |
| **Frontend** | **React 18 + TypeScript + Vite + Tailwind CSS** | Snappy SPA experience, type-safe API contracts, crisp responsive layouts, native drag-and-drop UX. |
| **Reverse Proxy / Isolation** | **Nginx + Docker Compose** | Enforces body size caps, security headers, and isolates the storage vault from webroot execution. |

### High-Level Architecture

```text
+-------------------+       HTTPS / Security Headers       +------------------------+
|  React + TS SPA   | <----------------------------------> |   Nginx Reverse Proxy  |
| (Drive Dashboard) |                                      | (Max Body Size, CSP)   |
+-------------------+                                      +-----------+------------+
                                                                       |
                                                                       v
                                                           +------------------------+
                                                           |    FastAPI Backend     |
                                                           | - Auth & RBAC (JWT)    |
                                                           | - Anti-IDOR Guard      |
                                                           | - Magic-Byte Validator |
                                                           | - Streaming I/O Engine |
                                                           +----+-------+-------+---+
                                                                |       |       |
                                  +-----------------------------+       |       +-------------------------+
                                  v                                     v                                 v
                        +-------------------+                 +-------------------+             +--------------------+
                        |   PostgreSQL 16   |                 |      Redis 7      |             | Isolated Storage   |
                        | - Users & Quotas  |                 | - Upload Rate     |             | Vault (/var/vault) |
                        | - Folders/Files   |                 |   Limiting        |             | - Outside Webroot  |
                        | - Share Tokens    |                 | - Token Denylist  |             | - UUIDv4 Filenames |
                        | - Audit Logs      |                 +-------------------+             | - chmod 0640       |
                        +-------------------+                                                   +--------------------+
```

---

## 2. UI/UX Design Direction (Modern SaaS — Zero "AI Clichés")

Many portfolio dashboards look instantly "AI-generated" because they overuse neon purple-to-pink gradients, dark-mode glowing cards, floating glassmorphism blobs, and cluttered iconography. To make **Secure-File-Management-Platform** look like a genuine Dribbble/Behance-caliber SaaS product (similar to **Linear**, **Dropbox**, and **Raycast**):

### Visual Language Guidelines
1. **Color Palette (Restrained Swiss Utility):**
   - **App Canvas:** Warm off-white `#F8F9FA` (never harsh `#FFFFFF` everywhere).
   - **Elevated Surfaces (Cards, Sidebar, Modals):** Crisp white `#FFFFFF` with subtle `1px solid #E5E7EB` borders instead of heavy drop shadows.
   - **Primary Ink:** Deep slate `#111827`; Secondary Ink: `#6B7280`.
   - **Single Brand Accent:** Deep Cobalt (`#2563EB`) or Editorial Teal (`#0F766E`) used strictly for primary CTAs, active folder selection, and upload progress bars.
   - **Semantic Status Colors:** Muted Emerald (`#059669`) for verified uploads, Amber (`#D97706`) for quota warnings (>80%), Crimson (`#DC2626`) for destructive actions or blocked file alerts.
2. **Typography:**
   - **UI Font:** `Inter` or `Plus Jakarta Sans` (clean geometric legibility, tight heading tracking `-0.02em`).
   - **Data / Technical Font:** `JetBrains Mono` or `IBM Plex Mono` for file sizes (`14.2 MB`), MIME types (`application/pdf`), SHA-256 hashes, and timestamps.
3. **Layout & Interactions (Inspired by Cloud Storage Dashboards):**
   - **Left Sidebar (240px):** Compact brand wordmark, primary `+ Upload` button, navigation (`My Drive`, `Shared Links`, `Recent`, `Trash`, `Admin Console` for admins), and a clean bottom **Storage Quota Widget** with a thin segmented progress bar.
   - **Top Utility Bar:** Interactive breadcrumb trail (`My Drive / Q3 Reports / Audits`), instant filename search, Grid/List view toggle, and user avatar menu.
   - **Full-Window Drag & Drop Overlay:** Dragging files anywhere over the browser triggers a crisp dashed border overlay (`Drop files to encrypt & upload to current folder`) with per-file progress bars and real-time validation feedback.
   - **Right Inspector Drawer (Optional on file click):** Displays file metadata (real detected MIME type, upload date, SHA-256 checksum, active share links, quick rename/download/delete).
4. **Explicit Anti-Patterns to Avoid:**
   - No neon gradients, no pulsing glow effects, no fake "AI Assistant" buttons, no emoji-heavy headings inside the app UI, and no oversized marketing hero cards inside the logged-in workspace.

---

## 3. Target Repository Structure

Keep the repository modular, readable, and strictly separated by concern:

```text
Secure-File-Management-Platform/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated pytest & lint checks
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py            # Auth, DB, RBAC & Ownership dependencies
│   │   │   └── v1/
│   │   │       ├── auth.py        # Register, login, refresh, logout
│   │   │       ├── folders.py     # Folder CRUD & hierarchy
│   │   │       ├── files.py       # Upload, download, rename, delete
│   │   │       ├── shares.py      # Secure share links
│   │   │       └── admin.py       # Admin dashboard telemetry & user quotas
│   │   ├── core/
│   │   │   ├── config.py          # Pydantic BaseSettings (.env validation)
│   │   │   ├── security.py        # Argon2id, JWT, secure token helpers
│   │   │   └── limiter.py         # Redis SlowAPI rate limiter
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py         # Async SQLAlchemy engine
│   │   ├── models/                # User, Folder, FileRecord, ShareLink, AuditLog
│   │   ├── schemas/               # Pydantic request/response DTOs
│   │   ├── services/
│   │   │   ├── file_validator.py  # Allowlist + python-magic inspection
│   │   │   ├── storage_service.py # UUIDv4 naming + path traversal guard
│   │   │   └── audit_service.py   # Security event logging
│   │   └── main.py                # FastAPI entrypoint & security middleware
│   ├── alembic/                   # Database migrations
│   ├── tests/                     # Unit & security penetration tests
│   ├── requirements.txt           # Pinned production dependencies
│   ├── requirements-dev.txt       # Testing & linting tools
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                   # Typed Axios/Fetch client with token refresh
│   │   ├── components/            # Sidebar, FileTable, DropZone, ShareModal, etc.
│   │   ├── context/               # Auth & Toast providers
│   │   ├── pages/                 # Login, Register, Drive, PublicShare, Admin
│   │   └── main.tsx
│   ├── package.json
│   └── Dockerfile
├── infra/
│   └── nginx/
│       └── default.conf           # Hardened reverse proxy & headers
├── docs/
│   └── screenshots/               # Clean UI screenshots for README.md
├── .env.example                   # Safe environment variable template
├── .gitignore
├── docker-compose.yml
├── SECURITY_REPORT.md             # Consolidated security engineering report
└── README.md                      # Polished GitHub front page
```

---

## 4. Prerequisites & Local Tool Installation

Before writing code, install the required tools on your machine.

### 1. Core Toolchain
- **Git** (`>= 2.40`): [git-scm.com](https://git-scm.com/)
- **Python 3.12+**: [python.org](https://www.python.org/)
- **Node.js 20 LTS + npm**: [nodejs.org](https://nodejs.org/)
- **Docker & Docker Compose**: [docker.com](https://www.docker.com/) (for PostgreSQL, Redis, and Nginx)

### 2. System Dependency for Magic-Byte Inspection (`libmagic`)
`python-magic` requires the native `libmagic` C library:

- **Ubuntu / Debian:**
  ```bash
  sudo apt-get update && sudo apt-get install -y libmagic1
  ```
- **macOS (Homebrew):**
  ```bash
  brew install libmagic
  ```
- **Windows:**
  Instead of installing `libmagic` manually, install `python-magic-bin` in your local Windows virtual environment (keep `python-magic` in `requirements.txt` for Linux/Docker production builds).

### 3. Verify Installations
```bash
git --version
python3 --version
node -v
docker --version
```

---

## 5. Commit-by-Commit Development Roadmap

Follow **Conventional Commits** strictly (`chore:`, `feat:`, `ui:`, `sec:`, `test:`, `docs:`). This creates a crystal-clear narrative in your Git log that recruiters and technical interviewers love inspecting.

---

### Phase 1: Repository Initialization & Scaffolding

#### Commit 1 — Initialize Repository & Environment Templates
1. Create the directory and initialize Git:
   ```bash
   mkdir Secure-File-Management-Platform && cd Secure-File-Management-Platform
   git init -b main
   ```
2. Create `.gitignore` ignoring Python caches (`__pycache__/`, `.venv/`), `node_modules/`, `.env`, local storage vaults (`storage_vault/`), IDE files, and `.DS_Store`.
3. Create `.env.example` containing placeholder keys (never commit real secrets):
   - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `STORAGE_ROOT`, `MAX_FILE_SIZE_BYTES`, `DEFAULT_USER_QUOTA_BYTES`, `ALLOWED_ORIGINS`.
4. Create the folder skeleton (`backend/`, `frontend/`, `infra/nginx/`, `docs/screenshots/`).

```bash
git add .gitignore .env.example
git commit -m "chore: initialize repository structure, gitignore, and environment template"
```

#### Commit 2 — Backend Virtual Environment & `requirements.txt`
1. Create and activate the Python virtual environment inside `backend/`:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   ```
2. Create `backend/requirements.txt` and `backend/requirements-dev.txt` using the exact templates in [Section 6A](#a-requirementstxt--requirements-devtxt).
3. Install dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt -r requirements-dev.txt
   ```
4. Create `backend/app/core/config.py` using `pydantic-settings` to strictly validate all environment variables on startup.

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/app/core/config.py
git commit -m "chore(backend): configure FastAPI dependencies, requirements.txt, and settings"
```

#### Commit 3 — Frontend Workspace Setup
1. Scaffold React + TypeScript with Vite:
   ```bash
   cd ../frontend
   npm create vite@latest . -- --template react-ts
   npm install axios lucide-react clsx tailwind-merge
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
2. Configure `tailwind.config.js` with your custom Swiss palette (`Inter` + `JetBrains Mono` loaded via Google Fonts or `@fontsource`) and clean base styles in `src/index.css`.

```bash
git add frontend/
git commit -m "chore(frontend): scaffold React TypeScript workspace with Tailwind CSS"
```

#### Commit 4 — Local Infrastructure (PostgreSQL, Redis & Isolated Volume)
1. Create `docker-compose.yml` defining:
   - `postgres:16-alpine` (with healthcheck and persistent volume)
   - `redis:7-alpine` (with password/internal network)
   - Dedicated named volume `isolated_file_vault` mounted outside webroot at `/var/lib/sfmp_vault` with non-root ownership.
2. Start services and verify connectivity:
   ```bash
   docker compose up -d postgres redis
   ```

```bash
git add docker-compose.yml
git commit -m "chore(infra): add Docker Compose for PostgreSQL, Redis, and isolated storage volume"
```

---

### Phase 2: Database Modeling & Authentication

#### Commit 5 — Relational Schema & Alembic Migrations
1. Initialize Alembic (`alembic init -t async alembic`) inside `backend/`.
2. Define SQLAlchemy 2.0 models in `backend/app/models/`:
   - `User`: `id (UUID)`, `email (unique)`, `full_name`, `password_hash`, `role (enum: user, admin)`, `storage_quota_bytes`, `storage_used_bytes`, `is_active`, `created_at`.
   - `Folder`: `id (UUID)`, `name`, `owner_id (FK User)`, `parent_id (FK Folder, nullable)`, `created_at`, `updated_at`. Add a unique constraint on `(owner_id, parent_id, name)`.
   - `FileRecord`: `id (UUID)`, `owner_id (FK User)`, `folder_id (FK Folder, nullable)`, `original_filename`, `storage_key (UUIDv4, unique)`, `detected_mime_type`, `extension`, `size_bytes`, `sha256_hash`, `created_at`, `updated_at`.
   - `ShareLink`: `id (UUID)`, `file_id (FK FileRecord)`, `created_by (FK User)`, `token_hash (SHA-256 of random URL token)`, `expires_at`, `max_downloads`, `download_count`, `is_revoked`, `created_at`.
   - `AuditLog`: `id (UUID)`, `user_id (nullable)`, `action`, `resource_type`, `resource_id`, `ip_address`, `status`, `details (JSONB)`, `created_at`.
3. Generate and apply initial migration:
   ```bash
   alembic revision --autogenerate -m "initial_schema"
   alembic upgrade head
   ```

```bash
git add backend/alembic/ backend/alembic.ini backend/app/db/ backend/app/models/
git commit -m "feat(db): design async SQLAlchemy models and initial Alembic migration"
```

#### Commit 6 — Secure Authentication & Session Management
1. Implement `backend/app/core/security.py`:
   - Password hashing using **Argon2id** (`argon2-cffi`).
   - Short-lived JWT Access Token (15 minutes) + Refresh Token (7 days) stored in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
   - Constant-time comparisons (`secrets.compare_digest`).
2. Implement `backend/app/api/v1/auth.py`:
   - `POST /api/v1/auth/register` (enforce strong password policy, assign default quota, log event).
   - `POST /api/v1/auth/login` (return generic `"Invalid credentials"` error to prevent account enumeration).
   - `POST /api/v1/auth/refresh` & `POST /api/v1/auth/logout` (revoke refresh token JTI in Redis).
   - `GET /api/v1/auth/me` (returns user profile + quota usage).
3. Create auth dependencies in `backend/app/api/deps.py`: `get_current_user` and `require_admin`.

```bash
git add backend/app/core/security.py backend/app/api/deps.py backend/app/api/v1/auth.py backend/app/schemas/auth.py
git commit -m "feat(auth): implement Argon2id hashing, JWT sessions, and HttpOnly refresh cookies"
```

#### Commit 7 — Minimalist Authentication UI
1. Build `frontend/src/pages/LoginPage.tsx` and `RegisterPage.tsx` using a split or centered card design on `#F8F9FA` with crisp `1px` borders, clear inline password strength feedback, and zero clutter.
2. Implement `AuthContext` and Axios interceptors for automatic silent token refresh on `401`.

```bash
git add frontend/src/api/ frontend/src/context/ frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "ui(auth): build clean login and registration pages with token refresh interceptor"
```

---

### Phase 3: Core Cloud Drive Engine

#### Commit 8 — Hierarchical Folder Management
1. Implement `backend/app/api/v1/folders.py`:
   - `POST /api/v1/folders` — Create root or nested folder (validate parent ownership).
   - `GET /api/v1/folders` & `GET /api/v1/folders/{folder_id}/contents` — Return child folders, files, and full breadcrumb path.
   - `PATCH /api/v1/folders/{folder_id}` — Rename folder (prevent duplicate sibling names).
   - `DELETE /api/v1/folders/{folder_id}` — Recursively delete folder, unlink stored physical files, and atomically decrement `User.storage_used_bytes`.

```bash
git add backend/app/api/v1/folders.py backend/app/schemas/folder.py
git commit -m "feat(folders): implement hierarchical folder CRUD, breadcrumbs, and recursive delete"
```

#### Commit 9 — Core File Upload, Streaming Download, Rename & Delete
1. Implement `backend/app/api/v1/files.py` and `backend/app/services/storage_service.py`:
   - `POST /api/v1/files/upload` — Stream uploaded file in 64KB chunks (never load huge files fully into RAM), compute SHA-256 hash on the fly, save metadata to PostgreSQL, update `storage_used_bytes` inside an atomic DB transaction.
   - `GET /api/v1/files/{file_id}/download` — Stream file back via `StreamingResponse` (never expose static file URLs).
   - `PATCH /api/v1/files/{file_id}` — Rename `original_filename` in database only (storage file on disk remains untouched).
   - `DELETE /api/v1/files/{file_id}` — Remove DB record, delete physical file from storage vault, decrement `storage_used_bytes`, and write audit log.

```bash
git add backend/app/api/v1/files.py backend/app/schemas/file.py backend/app/services/storage_service.py
git commit -m "feat(files): implement chunked file upload, streaming download, rename, and delete"
```

#### Commit 10 — Secure File Sharing Engine
1. Implement `backend/app/api/v1/shares.py`:
   - `POST /api/v1/files/{file_id}/share` — Generate a 256-bit cryptographically secure token (`secrets.token_urlsafe(32)`). Store only its **SHA-256 hash** in `ShareLink.token_hash` (so even a DB leak cannot expose active share links). Support optional `expires_in_hours` and `max_downloads`.
   - `GET /api/v1/shares` — List user's active share links.
   - `DELETE /api/v1/shares/{share_id}` — Revoke share link immediately.
   - `GET /api/v1/public/share/{raw_token}` — Return safe metadata (filename, size, MIME, expiry).
   - `GET /api/v1/public/share/{raw_token}/download` — Atomically verify not revoked, not expired, and `download_count < max_downloads`, increment counter, and stream file safely.

```bash
git add backend/app/api/v1/shares.py backend/app/schemas/share.py
git commit -m "feat(sharing): add expiring tokenized file sharing with hashed tokens and download caps"
```

#### Commit 11 — Admin Management & Audit Telemetry API
1. Implement `backend/app/api/v1/admin.py` (strictly protected by `Depends(require_admin)`) and `backend/app/services/audit_service.py`:
   - `GET /api/v1/admin/overview` — Total users, total files, total storage consumed, blocked upload attempts (last 24h).
   - `GET /api/v1/admin/users` — Paginated user list with storage usage, quota, role, and active status.
   - `PATCH /api/v1/admin/users/{user_id}` — Update user storage quota or suspend/reactivate account.
   - `GET /api/v1/admin/audit-logs` — Filterable security audit log (uploads, failed validations, share downloads, deletions, access denials).
2. Add a CLI/script (`backend/scripts/seed_admin.py`) to bootstrap the initial admin account safely.

```bash
git add backend/app/api/v1/admin.py backend/app/services/audit_service.py backend/scripts/seed_admin.py
git commit -m "feat(admin): add admin dashboard API for user quotas, storage metrics, and audit logs"
```

---

### Phase 4: Handcrafted Modern Frontend

#### Commit 12 — Responsive Drive Shell & Storage Quota Meter
1. Build `DriveLayout.tsx` featuring:
   - Fixed 240px collapsible sidebar (`#FFFFFF`, `1px` right border `#E5E7EB`).
   - Storage meter component showing exact `used / quota` in monospace (`420 MB / 1.0 GB`) with smooth threshold coloring.
   - Top search bar + user dropdown.

```bash
git add frontend/src/components/layout/
git commit -m "ui(layout): build refined SaaS workspace shell with sidebar and storage quota meter"
```

#### Commit 13 — File Explorer, Drag-and-Drop Uploader & Details Drawer
1. Build:
   - `FileExplorer.tsx` with Grid View and Data Table View toggle, breadcrumb navigation, and folder creation modal.
   - `DragDropOverlay.tsx` supporting multi-file drag-and-drop with live chunk upload progress bars and clear error badges if the backend rejects an unsafe file.
   - `FileContextMenu.tsx` (Download, Rename, Share, Delete) and `FileInspectorDrawer.tsx` (showing MIME type, SHA-256 fingerprint, size, and created date).

```bash
git add frontend/src/components/files/ frontend/src/pages/DrivePage.tsx
git commit -m "ui(files): implement drag-and-drop uploader, grid/list file explorer, and inspector drawer"
```

#### Commit 14 — File Sharing Modal & Public Download Page
1. Build `ShareModal.tsx` allowing owners to configure link expiration (1h, 24h, 7d, 30d), max download count, copy-to-clipboard with confirmation, and revoke active links.
2. Build `PublicSharePage.tsx` (`/s/:token`) displaying a crisp, trustworthy file card with filename, verified MIME type, file size, SHA-256 hash, and a single Download button.

```bash
git add frontend/src/components/sharing/ frontend/src/pages/PublicSharePage.tsx
git commit -m "ui(sharing): add share link management modal and clean public download view"
```

#### Commit 15 — Admin Management Dashboard
1. Build `AdminDashboardPage.tsx` (visible only to `role === 'admin'`):
   - Four crisp KPI cards (Total Storage, Active Users, Total Stored Objects, Blocked Security Events).
   - User Management table with inline Quota Editor modal and Suspend/Activate toggle.
   - Live Security Audit Log viewer with filter pills (`ALL`, `UPLOAD_BLOCKED`, `ACCESS_DENIED`, `SHARE_CREATED`).

```bash
git add frontend/src/pages/AdminDashboardPage.tsx frontend/src/components/admin/
git commit -m "ui(admin): build admin console for storage analytics, user quotas, and security logs"
```

---

### Phase 5: Security Hardening (Separate Commits + Report Updates)

> **Critical Workflow Rule:** Implement each of the **7 security controls** below in its **own dedicated Git commit**. Immediately after verifying each control, append its corresponding English technical report section from [Section 6C](#c-consolidated-security_reportmd-all-7-security-domains) into your single root `SECURITY_REPORT.md` file (either in the same security commit or in the final report commit—committing the matching report section alongside each control is great practice!).

#### Commit 16 — Security Control #1: Strict File Extension Allowlist & Filename Sanitization
- **Implementation (`backend/app/services/file_validator.py`):**
  1. Never use a denylist (e.g., blocking `.exe`, `.php` is trivially bypassed by `.phtml`, `.phar`, `.svg`, `.shtml`).
  2. Enforce a strict **Allowlist** of permitted extensions mapped to permitted MIME types:
     - Documents: `.pdf`, `.txt`, `.csv`, `.docx`, `.xlsx`, `.pptx`
     - Images: `.png`, `.jpg`, `.jpeg`, `.webp`
     - Archives: `.zip`
  3. Reject double/suspicious extensions or null bytes (`\x00`), strip Unicode control characters, normalize display filenames to safe UTF-8 characters (max 150 chars), and explicitly block active web/script types (`.html`, `.htm`, `.svg`, `.js`, `.php`, `.sh`, `.exe`, `.bat`).
- **Verification:** Attempt uploading `shell.php`, `payload.svg`, and `invoice.pdf.exe` -> confirm `400/415` rejection and `UPLOAD_BLOCKED` audit log entry.
- **Report:** Add **Section 1 (Extension Allowlist & Filename Sanitization)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/services/file_validator.py SECURITY_REPORT.md
git commit -m "sec(upload): enforce strict file extension allowlist and filename sanitization"
```

#### Commit 17 — Security Control #2: File Content & Magic-Byte MIME Validation
- **Implementation (`backend/app/services/file_validator.py`):**
  1. Never trust the client-supplied `Content-Type` header (`file.content_type`)—attackers spoof it effortlessly.
  2. Read the first `4096` bytes of the incoming stream and inspect binary magic numbers using `magic.from_buffer(header_bytes, mime=True)`.
  3. Cross-check that the **detected MIME type** strictly matches the allowed MIME types for the file's **claimed extension** (e.g., a `.png` file *must* inspect as `image/png`, not `text/x-php` or `text/html`).
  4. For images (`.png`, `.jpg`, `.webp`), optionally verify structural integrity with Pillow (`Image.verify()`) to reject malformed polyglot payloads.
  5. Reset stream offset (`await file.seek(0)`) before writing.
- **Verification:** Rename a Bash/PHP script (`<?php system($_GET['c']); ?>`) to `avatar.png` and upload it -> confirm server detects `text/x-php` / `text/plain`, rejects with `415 Unsupported Media Type`, and logs the spoof attempt.
- **Report:** Append **Section 2 (Content & Magic-Byte Validation)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/services/file_validator.py backend/app/api/v1/files.py SECURITY_REPORT.md
git commit -m "sec(validation): implement magic-byte MIME content verification with python-magic"
```

#### Commit 18 — Security Control #3: Path Traversal Prevention
- **Implementation (`backend/app/services/storage_service.py`):**
  1. Never construct filesystem paths using user-provided filenames or folder names (`os.path.join(base, user_filename)` is vulnerable).
  2. Implement a centralized `resolve_safe_path(storage_key: str) -> Path` helper:
     - Validate `storage_key` strictly matches UUIDv4 regex (`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).
     - Compute `target = (STORAGE_ROOT / storage_key[:2] / storage_key).resolve()`.
     - Assert `target.is_relative_to(STORAGE_ROOT.resolve())` (raise `SecurityViolationError` if violated).
  3. Also reject `..`, `/`, and `\` inside logical folder/file display names at the Pydantic schema level.
- **Verification:** Send filenames like `../../../../etc/passwd` and `..\windows\win.ini` -> confirm complete isolation and zero filesystem traversal.
- **Report:** Append **Section 3 (Path Traversal Prevention)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/services/storage_service.py backend/app/schemas/ SECURITY_REPORT.md
git commit -m "sec(storage): prevent path traversal via canonical path confinement and strict key regex"
```

#### Commit 19 — Security Control #4: Cryptographic Randomized File Naming
- **Implementation (`backend/app/services/storage_service.py`):**
  1. Completely decouple the **logical display name** (stored in PostgreSQL `FileRecord.original_filename`) from the **physical object key** on disk.
  2. Generate `storage_key = str(uuid.uuid4())` on the server—stored **without any file extension** inside sharded subdirectories (e.g., `/var/lib/sfmp_vault/a4/a4f8c2...`).
  3. Benefits: Prevents filename collisions, eliminates OS special-character exploits, prevents guessing file URLs, and removes file extensions on disk so OS/web handlers cannot infer executable types.
- **Verification:** Upload two files named `report.pdf` -> verify both persist cleanly with distinct UUIDv4 disk filenames and zero extension on disk.
- **Report:** Append **Section 4 (Randomized Storage Filenames)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/services/storage_service.py backend/app/api/v1/files.py SECURITY_REPORT.md
git commit -m "sec(storage): decouple display names using extensionless UUIDv4 randomized filenames"
```

#### Commit 20 — Security Control #5: Object-Level Authorization (Anti-IDOR & Tenant Isolation)
- **Implementation (`backend/app/api/deps.py` & all routers):**
  1. Use non-sequential **UUIDv4** primary keys for all `User`, `Folder`, and `FileRecord` entities to block resource enumeration.
  2. Enforce mandatory server-side ownership checks on **every** query (`WHERE id = :file_id AND owner_id = :current_user_id`). Never trust a `user_id` sent in request body or query params.
  3. Create reusable FastAPI authorization dependencies: `get_owned_file(file_id, current_user)` and `get_owned_folder(folder_id, current_user)`.
  4. Return consistent `404 Not Found` (or `403` with audit logging as `ACCESS_DENIED`) when User A attempts to read, download, rename, share, or delete User B's resources, preventing resource existence leaks.
- **Verification:** Authenticate as User B and send `GET/PATCH/DELETE` requests targeting User A's `file_id` and `folder_id` -> verify 100% denial and audit log recording.
- **Report:** Append **Section 5 (Broken Object-Level Authorization / Anti-IDOR)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/api/deps.py backend/app/api/v1/ SECURITY_REPORT.md
git commit -m "sec(access-control): enforce strict object-level ownership guards across all endpoints"
```

#### Commit 21 — Security Control #6: Upload Size Limits, Quotas & Rate Limiting
- **Implementation (`backend/app/core/limiter.py`, `files.py`, `infra/nginx/default.conf`):**
  1. **Edge Limit (Nginx):** Set `client_max_body_size 25M;` so oversized payloads are dropped before touching Python workers.
  2. **Streaming Byte Counter (FastAPI):** Count exact bytes while streaming chunks—do **not** rely solely on the `Content-Length` header (which can be omitted via `Transfer-Encoding: chunked` or forged). Abort immediately and delete the temporary partial file if `bytes_written > MAX_FILE_SIZE_BYTES`.
  3. **Atomic Storage Quota Enforcement:** Before finalizing upload, lock the user row (`SELECT ... FOR UPDATE`) and verify `storage_used_bytes + file_size <= storage_quota_bytes`.
  4. **Redis-Backed Rate Limiting (`SlowAPI`):**
     - `POST /api/v1/auth/login`: `5/minute` per IP
     - `POST /api/v1/files/upload`: `15/minute` & `100/hour` per user ID
     - `GET /api/v1/public/share/*`: `30/minute` per IP
- **Verification:** Upload a 30MB dummy file -> rejected with `413 Payload Too Large`; send 20 rapid upload requests -> rejected with `429 Too Many Requests`.
- **Report:** Append **Section 6 (Size Limits, Quotas & Rate Limiting)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/core/limiter.py backend/app/api/v1/files.py backend/app/api/v1/auth.py infra/nginx/default.conf SECURITY_REPORT.md
git commit -m "sec(dos): enforce streaming file size caps, atomic quotas, and Redis rate limiting"
```

#### Commit 22 — Security Control #7: Preventing Execution of Uploaded Files
- **Implementation (`backend/app/main.py`, `files.py`, `storage_service.py`, `infra/nginx/default.conf`):**
  1. **Storage Isolation Outside Webroot:** Never mount `/var/lib/sfmp_vault` inside Nginx's `root` or FastAPI's `StaticFiles`. Files can *only* be accessed through authenticated API streaming endpoints.
  2. **Non-Executable Filesystem Permissions:** Write files with `0o640` permissions (`rw-r-----`, zero execute bit) and mount the Docker storage volume with `noexec,nosuid,nodev` where supported.
  3. **Forced Safe Download Headers:** On every download response (`/files/{id}/download` and `/public/share/{token}/download`), set:
     - `Content-Disposition: attachment; filename="<sanitized>"; filename*=UTF-8''<url_encoded>` (forces download, prevents inline browser rendering/Stored XSS).
     - `X-Content-Type-Options: nosniff` (disables browser MIME sniffing).
     - `Content-Security-Policy: default-src 'none'; sandbox` (prevents script execution even if rendered).
     - `Cache-Control: private, no-store` (prevents shared proxies from caching private documents).
  4. **Global API/Frontend Security Headers (Nginx & FastAPI Middleware):** `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and strict CORS allowlist.
- **Verification:** Inspect download HTTP headers via `curl -I` and verify `attachment`, `nosniff`, `sandbox`, and non-executable disk permissions (`ls -la`).
- **Report:** Append **Section 7 (Preventing Uploaded File Execution)** to `SECURITY_REPORT.md`.

```bash
git add backend/app/main.py backend/app/api/v1/files.py backend/app/api/v1/shares.py infra/nginx/default.conf SECURITY_REPORT.md
git commit -m "sec(execution): harden storage isolation, permissions, CSP sandbox, and download headers"
```

---

### Phase 6: Security Testing & Portfolio Polish

#### Commit 23 — Automated Security & Regression Test Suite
1. Create `backend/tests/test_security.py` using `pytest` + `httpx.AsyncClient` testing every security control automatically:
   - `test_rejects_disallowed_extension`
   - `test_rejects_spoofed_mime_magic_bytes`
   - `test_blocks_path_traversal_filenames`
   - `test_randomized_uuid_storage_key_without_extension`
   - `test_prevents_cross_user_idor_read_rename_delete`
   - `test_enforces_file_size_limit_and_user_quota`
   - `test_enforces_upload_rate_limit`
   - `test_download_headers_prevent_inline_execution`
2. Add `.github/workflows/ci.yml` to run `pytest` and `ruff` on every push/PR.

```bash
git add backend/tests/ .github/workflows/ci.yml
git commit -m "test(security): add automated pytest suite covering all 7 security controls and CI workflow"
```

#### Commit 24 — Capture Clean Screenshots & Finalize `README.md`
1. Run the full stack (`docker compose up --build`), seed demo data (clean, realistic business folders like `Product Specs`, `Q4 Financials`, `Design Assets`), and capture crisp 1440×900 screenshots saved to `docs/screenshots/`:
   - `drive-dashboard.png`
   - `drag-drop-upload.png`
   - `share-modal.png`
   - `admin-console.png`
2. Write the polished root `README.md` using [Section 6B](#b-portfolio-ready-readmemd-template).

```bash
git add docs/screenshots/ README.md
git commit -m "docs: add polished GitHub README with architecture, security overview, and screenshots"
```

---

## 6. Ready-to-Use Repository Files

### A. `requirements.txt` & `requirements-dev.txt`

Save this as `backend/requirements.txt`:

```text
# Web Framework & ASGI Server
fastapi==0.115.6
uvicorn[standard]==0.32.1
python-multipart==0.0.19

# Validation & Configuration
pydantic==2.10.3
pydantic-settings==2.6.1
email-validator==2.2.0

# Database & Migrations
SQLAlchemy==2.0.36
asyncpg==0.30.0
alembic==1.14.0

# Security, Cryptography & Auth
argon2-cffi==23.1.0
PyJWT==2.10.1
python-magic==0.4.27
Pillow==11.0.0

# Rate Limiting & Caching
redis==5.2.0
slowapi==0.1.9

# Async File I/O
aiofiles==24.1.0
```

Save this as `backend/requirements-dev.txt`:

```text
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.28.1
ruff==0.8.2
aiosqlite==0.20.0
```

---

### B. Portfolio-Ready `README.md` Template

Save this as root `README.md` (update `<your-username>` and screenshot links):

```markdown
<div align="center">

# Secure File Management Platform

**A security-first cloud storage & file management platform built with FastAPI, PostgreSQL, Redis, and React.**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Security Tested](https://img.shields.io/badge/Security-OWASP%20Hardened-0F766E?style=flat-square)](./SECURITY_REPORT.md)

[Features](#-core-features) • [Security Architecture](#-security-controls) • [Architecture](#-system-architecture) • [Quick Start](#-quick-start) • [Security Report](./SECURITY_REPORT.md)

</div>

---

## Overview

**Secure-File-Management-Platform** is a full-stack cloud drive application inspired by modern SaaS file workspaces. Unlike a basic upload form, it is architected from the ground up with **defense-in-depth file security**, **strict multi-tenant access control**, **streaming I/O**, and **comprehensive audit logging**.

![Drive Workspace](./docs/screenshots/drive-dashboard.png)

---

## Core Features

- **Authentication & Sessions:** Registration and login powered by Argon2id password hashing, short-lived JWTs, and `HttpOnly` refresh cookies with Redis revocation.
- **Hierarchical File Explorer:** Create nested folders, navigate via breadcrumbs, switch between Grid/List views, search files, rename, and recursively delete folders.
- **Chunked Drag-and-Drop Uploads:** Stream uploads directly to an isolated vault with real-time progress tracking and SHA-256 integrity hashing.
- **Secure Expiring File Sharing:** Generate high-entropy share links (stored as SHA-256 hashes) with configurable expiration times, download limits, and instant revocation.
- **Storage Quotas & Limits:** Per-file size limits and atomic per-user storage quota tracking.
- **Admin Console:** Monitor total storage telemetry, adjust user quotas, suspend accounts, and inspect security audit logs.

---

## Security Controls

Every security requirement is implemented as a dedicated, tested defense layer and documented in detail inside [`SECURITY_REPORT.md`](./SECURITY_REPORT.md):

| Security Domain | Defense Mechanism Implemented |
| :--- | :--- |
| **Extension Control** | Strict extension allowlist + filename sanitization (blocks scripts, HTML, SVG, executables) |
| **Content Verification** | Binary magic-byte MIME inspection (`python-magic`) cross-checked against claimed extension |
| **Path Traversal Defense** | Canonical path confinement (`Path.resolve()` + `is_relative_to()`) & zero user input in FS paths |
| **Storage Anonymization** | Extensionless cryptographic `UUIDv4` disk filenames decoupled from database display names |
| **Tenant Isolation (Anti-IDOR)** | Mandatory server-side object ownership checks (`owner_id`) on every file/folder endpoint |
| **Abuse & DoS Prevention** | Nginx body limits, streaming byte counters, atomic DB quotas, and Redis-backed rate limiting |
| **Execution Prevention** | Storage vault isolated outside webroot, `0640` permissions, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `CSP: sandbox` |

---

## System Architecture

```text
Browser (React + TS) ──▶ Nginx (TLS, Size Cap, Headers) ──▶ FastAPI Async API
                                                                ├── PostgreSQL 16 (Metadata, Quotas, Audit Logs)
                                                                ├── Redis 7 (Rate Limiting, Revoked Tokens)
                                                                └── /var/lib/sfmp_vault (Isolated UUIDv4 Files)
```

---

## Quick Start

### 1. Clone & Configure Environment
```bash
git clone https://github.com/<your-username>/Secure-File-Management-Platform.git
cd Secure-File-Management-Platform
cp .env.example .env
# Edit .env and set a strong JWT_SECRET_KEY
```

### 2. Run with Docker Compose (Recommended)
```bash
docker compose up --build -d
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed_admin.py
```
- **Frontend Workspace:** `http://localhost:8080`
- **Interactive API Docs:** `http://localhost:8080/api/docs`

### 3. Local Development Setup (Without Docker for App Servers)
```bash
# Start PostgreSQL & Redis
docker compose up -d postgres redis

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Running Security & Automated Tests

```bash
cd backend
pytest -v
```

---

## Screenshots

| Drag & Drop Upload | Secure Link Sharing | Admin Audit Console |
| :---: | :---: | :---: |
| ![Upload](./docs/screenshots/drag-drop-upload.png) | ![Share](./docs/screenshots/share-modal.png) | ![Admin](./docs/screenshots/admin-console.png) |

---

## License

This project is licensed under the MIT License.
```

---

### C. Consolidated `SECURITY_REPORT.md` (All 7 Security Domains)

Save this as a single file at the repository root: `SECURITY_REPORT.md`. As you complete each commit in **Phase 5**, populate/verify the corresponding section and record the actual commit hash.

```markdown
# Security Engineering & Hardening Report
**Project:** Secure-File-Management-Platform  
**Methodology:** OWASP ASVS v4.0 / OWASP File Upload Cheat Sheet  
**Document Scope:** Consolidated threat model, architectural mitigations, and verification results for all seven security controls implemented in the platform.

---

## Executive Summary

File upload and cloud storage systems represent one of the highest-risk attack surfaces in modern web applications. Improperly validated uploads can escalate to Remote Code Execution (RCE), Stored Cross-Site Scripting (XSS), Server-Side Path Traversal, Broken Object-Level Authorization (IDOR), and Storage Exhaustion (DoS).

This report documents the defense-in-depth controls engineered into **Secure-File-Management-Platform**, where every security control was designed, implemented, verified, and committed independently.

| # | Security Control | Target Vulnerability (OWASP / CWE) | Status | Commit Reference |
| :-: | :--- | :--- | :---: | :--- |
| 1 | Strict Extension Allowlist & Filename Sanitization | Unrestricted File Upload (CWE-434) | Verified | `sec(upload): ...` |
| 2 | Magic-Byte MIME Content Inspection | MIME Spoofing & Polyglot Uploads (CWE-434) | Verified | `sec(validation): ...` |
| 3 | Path Traversal Prevention | Path Traversal (CWE-22) | Verified | `sec(storage): ...` |
| 4 | Cryptographic Randomized Storage Naming | Predictable Resource Location / Collisions (CWE-552) | Verified | `sec(storage): ...` |
| 5 | Object-Level Authorization (Anti-IDOR) | Broken Object Level Authorization (OWASP API1 / CWE-639) | Verified | `sec(access-control): ...` |
| 6 | Size Caps, Atomic Quotas & Rate Limiting | Resource Consumption / DoS (CWE-400 / CWE-770) | Verified | `sec(dos): ...` |
| 7 | Preventing Uploaded File Execution | RCE & Stored XSS via File Hosting (CWE-434 / CWE-79) | Verified | `sec(execution): ...` |

---

## 1. Extension Allowlist & Filename Sanitization

### Threat Vector
Relying on a denylist (e.g., blocking `.php` or `.exe`) consistently fails against alternative executable or browser-interpreted extensions such as `.phtml`, `.phar`, `.svg`, `.shtml`, `.html`, or uppercase bypasses (`.PhP`). Additionally, unsanitized filenames containing null bytes (`%00`) or control characters can corrupt logs, headers, or downstream parsers.

### Implemented Defense
- **Strict Allowlist Policy:** Only explicitly approved document, image, and archive extensions (`.pdf`, `.txt`, `.csv`, `.docx`, `.xlsx`, `.pptx`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip`) are accepted. Active web formats including `.svg` and `.html` are explicitly excluded to eliminate Stored XSS vectors.
- **Extension Normalization:** Filenames are stripped of leading/trailing whitespace, checked for null bytes, and evaluated using the final lowercased suffix via `pathlib.Path(filename).suffix.lower()`.
- **Display Name Sanitization:** Logical display names stored in PostgreSQL are sanitized against control characters, path separators (`/`, `\`), and capped at 150 characters.

### Verification
- **Test Case:** Uploaded `webshell.php`, `xss.svg`, `exploit.html`, and `document.pdf.exe`.
- **Expected & Observed Result:** Server rejected all payloads with HTTP `400 Bad Request` / `415 Unsupported Media Type` before writing to disk and recorded an `UPLOAD_BLOCKED` entry in `audit_logs`.

---

## 2. File Content & Magic-Byte MIME Validation

### Threat Vector
HTTP `Content-Type` headers and file extensions are fully attacker-controlled. An attacker can rename a PHP script or HTML/JavaScript payload to `invoice.pdf` or `avatar.png` and send `Content-Type: image/png` to bypass naive validation.

### Implemented Defense
- **Binary Header Inspection:** Rather than trusting client headers, the backend reads the initial 4,096 bytes of the uploaded byte stream and inspects the binary signature (magic bytes) via `python-magic` (`libmagic`).
- **Extension-to-MIME Cross-Matrix:** The detected MIME type must belong to the exact set of permitted MIME types mapped to the file's claimed extension (e.g., `.pdf` must inspect strictly as `application/pdf`; `.png` must inspect as `image/png`).
- **Structural Image Verification:** Uploaded raster images undergo structural verification via Pillow (`Image.verify()`) to reject corrupted or disguised polyglot payloads.

### Verification
- **Test Case:** Created a file containing `<?php echo shell_exec($_GET['cmd']); ?>`, renamed it to `photo.png`, and submitted it with header `Content-Type: image/png`.
- **Expected & Observed Result:** `libmagic` identified the stream as `text/x-php` / `text/plain`, mismatched against `.png`'s allowed MIME (`image/png`), immediately aborted the upload (`415`), and logged the spoofing attempt.

---

## 3. Path Traversal Prevention

### Threat Vector
If user-supplied filenames or folder paths are concatenated with a storage directory (e.g., `uploads/ + filename`), payloads containing `../` or `..\` allow attackers to overwrite critical system files, read sensitive configuration files (`.env`), or escape their isolated storage directory.

### Implemented Defense
- **Zero User Input in Filesystem Paths:** Logical folder hierarchy exists exclusively as relational foreign keys in PostgreSQL (`Folder.parent_id`), never as OS directories.
- **Strict Storage Key Validation:** All disk operations validate that the storage identifier strictly matches a UUIDv4 regex pattern.
- **Canonical Path Confinement:** Every resolved disk path is verified with `resolved_path = (STORAGE_ROOT / prefix / key).resolve()` followed by an invariant check `assert resolved_path.is_relative_to(STORAGE_ROOT.resolve())`. Any violation raises a fatal security exception and triggers an audit alert.

### Verification
- **Test Case:** Submitted filenames `../../../../etc/passwd`, `..%2F..%2F.env`, and `..\secret.txt` across upload and rename endpoints.
- **Expected & Observed Result:** Traversal characters were rejected at schema validation; storage layer confinement independently guarantees that no file operation can ever escape `/var/lib/sfmp_vault`.

---

## 4. Cryptographic Randomized File Naming

### Threat Vector
Storing uploaded files under user-chosen filenames introduces multiple risks: predictable file URLs, race-condition overwrites between users, OS-specific reserved filename bugs (e.g., `CON`, `NUL`, Unicode homoglyphs), and accidental handler mapping based on file extensions on disk.

### Implemented Defense
- **Full Decoupling:** User-facing names reside strictly in PostgreSQL (`FileRecord.original_filename`). Physical files on disk are stored under server-generated cryptographic `UUIDv4` keys (122 bits of entropy) inside 2-character sharded directories (e.g., `/var/lib/sfmp_vault/9f/9f8b...`).
- **Extensionless Storage:** Physical files are written **without any file extension**, ensuring neither the OS nor any auxiliary daemon associates an executable handler with stored blobs.
- **Integrity Fingerprinting:** Every uploaded file's `SHA-256` digest is computed during streaming and stored alongside metadata for integrity verification.

### Verification
- **Test Case:** Uploaded two distinct files identically named `quarterly-report.pdf` into the same account/different folders and inspected `/var/lib/sfmp_vault`.
- **Expected & Observed Result:** Both files stored cleanly without collision under separate extensionless UUIDv4 filenames, while downloading restored the exact original filename via HTTP headers.

---

## 5. Preventing Unauthorized Cross-User File Access (Anti-IDOR)

### Threat Vector
Insecure Direct Object Reference (IDOR / OWASP API1) occurs when an authenticated user modifies a resource identifier (`file_id` or `folder_id`) in an API request to read, download, rename, share, or delete another user's private files.

### Implemented Defense
- **Non-Sequential Identifiers:** All primary keys (`User`, `Folder`, `FileRecord`, `ShareLink`) use `UUIDv4` rather than auto-incrementing integers, preventing blind enumeration.
- **Mandatory Ownership Scoped Queries:** Every single file and folder endpoint injects a FastAPI authorization dependency (`get_owned_file`, `get_owned_folder`) that derives `user_id` exclusively from the cryptographically verified JWT and queries `WHERE id = :resource_id AND owner_id = :current_user_id`.
- **Non-Leaking Error Responses:** Unauthorized access attempts return `404 Not Found` (preventing attackers from probing whether a given UUID belongs to another tenant) while recording an internal `ACCESS_DENIED` event in `audit_logs`.
- **Token-Hashed Public Shares:** Public access is permitted *only* via `/api/v1/public/share/{token}`, where the presented 256-bit token is SHA-256 hashed and checked against expiry, revocation, and download caps.

### Verification
- **Test Case:** Created User A and User B. User A uploaded a private file (`file_id_A`). Authenticated as User B, attempted `GET /download`, `PATCH /rename`, `POST /share`, and `DELETE` against `file_id_A`.
- **Expected & Observed Result:** Every request returned `404` with zero data disclosure, and each unauthorized probe was captured in the admin audit trail.

---

## 6. Upload Size Limits, Atomic Quotas & Rate Limiting

### Threat Vector
Without strict resource bounds, malicious or compromised accounts can exhaust server RAM, fill disk partitions (Denial of Service), or brute-force authentication and public share endpoints.

### Implemented Defense
- **Multi-Layer Size Enforcement:**
  1. *Reverse Proxy Layer:* Nginx enforces `client_max_body_size 25M;` to reject oversized requests at the network edge.
  2. *Application Streaming Layer:* FastAPI streams uploads in 64KB chunks and maintains an exact byte counter independent of the spoofable `Content-Length` header. If the stream exceeds `MAX_FILE_SIZE_BYTES`, streaming halts immediately and the partial temporary file is unlinked.
- **Atomic User Storage Quotas:** Before committing a file, the database acquires a row-level lock (`SELECT ... FOR UPDATE`) on the user record to prevent concurrent upload race conditions from bypassing `storage_quota_bytes`.
- **Redis-Backed Rate Limiting:** Implemented via `SlowAPI` + Redis:
  - Login attempts: `5 requests / minute` per IP.
  - File uploads: `15 requests / minute` and `100 requests / hour` per authenticated user.
  - Public share lookups: `30 requests / minute` per IP.

### Verification
- **Test Case:** (a) Streamed a 30MB binary file; (b) Attempted uploading a file exceeding remaining user quota; (c) Dispatched 20 rapid upload requests within 10 seconds.
- **Expected & Observed Result:** (a) Rejected with `413 Payload Too Large` with zero residual temp files; (b) Rejected with `403 / 413 Quota Exceeded`; (c) Requests beyond threshold returned `429 Too Many Requests` with `Retry-After` header.

---

## 7. Preventing Execution of Uploaded Files

### Threat Vector
If uploaded files are stored inside a publicly served webroot or rendered inline by a browser, attackers can achieve Server-Side Code Execution (via misconfigured script interpreters) or Client-Side Stored XSS (via browser MIME sniffing or inline rendering of active content).

### Implemented Defense
- **Strict Webroot Isolation:** The storage vault (`/var/lib/sfmp_vault`) is completely outside Nginx's static serving paths and FastAPI's `StaticFiles`. No direct URL maps to any uploaded file; every byte must flow through authenticated FastAPI streaming endpoints.
- **Least-Privilege OS Permissions:** Uploaded files are created with mode `0640` (non-executable) owned by a dedicated unprivileged service user, and the Docker storage volume is configured without execute privileges where supported.
- **Defensive Download Response Headers:** Every file download enforces:
  - `Content-Disposition: attachment; filename="<sanitized>"` — forces browser download rather than inline execution/rendering.
  - `X-Content-Type-Options: nosniff` — prevents browsers from overriding declared MIME types via content sniffing.
  - `Content-Security-Policy: default-src 'none'; sandbox` — isolates the response in a null-origin sandbox with scripts disabled.
  - `Cache-Control: private, no-store` — prevents intermediate proxies from caching confidential files.
- **Reverse Proxy Hardening:** Nginx disables `autoindex`, hides server version tokens (`server_tokens off;`), and enforces `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin`.

### Verification
- **Test Case:** Inspected physical file permissions on the storage volume (`ls -la`) and audited HTTP download headers via `curl -I`.
- **Expected & Observed Result:** All stored files exhibited `-rw-r-----` permissions with zero execute bits; download responses consistently delivered `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'; sandbox`.

---

## Conclusion & Continuous Security Posture

By separating identity, metadata, access control, content inspection, and physical storage into distinct layers, **Secure-File-Management-Platform** eliminates the entire class of common file-upload vulnerabilities. Every control documented above is continuously enforced by the automated test suite in `backend/tests/test_security.py` and executed via GitHub Actions CI on every code change.
```

---

## 7. Git Best Practices & Interview Talking Points

### Clean Branching Strategy (Optional Polish)
If you want your GitHub repository to look like an engineering team built it:
- Keep `main` always deployable.
- Develop each phase or security control on a short-lived branch (e.g., `feat/file-sharing`, `sec/magic-byte-validation`) and merge cleanly into `main`.

### How to Present This Project to Employers
When walking a hiring manager or technical interviewer through `Secure-File-Management-Platform`, highlight these architectural decisions:
1. **"Why didn't you just save files in a `/static/uploads` folder?"** -> Explain webroot isolation, RCE/XSS prevention, and why files are streamed through an authorization gate.
2. **"How do you stop someone from renaming a script to `.jpg`?"** -> Explain the two-layer check: strict extension allowlist + binary magic-byte inspection via `python-magic` + structural verification.
3. **"What if a user sends two concurrent uploads to bypass their storage quota?"** -> Explain PostgreSQL `SELECT ... FOR UPDATE` row-level locking and streaming byte counters independent of `Content-Length`.
4. **"How do you prevent users from accessing each other's files?"** -> Explain UUIDv4 identifiers, JWT-derived ownership dependencies, and returning `404` on cross-tenant probes with audit logging.