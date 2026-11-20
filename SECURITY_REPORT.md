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

Relying on a denylist (blocking `.php` or `.exe`) consistently fails against alternative executable or browser-interpreted extensions such as `.phtml`, `.phar`, `.svg`, `.shtml`, `.html`, or uppercase bypasses (`.PhP`). Additionally, unsanitized filenames containing null bytes (`%00`) or control characters can corrupt logs, headers, or downstream parsers.

### Implemented Defense

- **Strict Allowlist Policy:** Only explicitly approved extensions are accepted, each mapped to its expected MIME family: `.pdf`, `.txt`, `.csv`, `.docx`, `.xlsx`, `.pptx`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip`. Active web/script formats (`.svg`, `.html`, `.js`, `.php`, `.sh`, `.exe`, …) are excluded by omission and additionally enumerated in `BLOCKED_EXTENSIONS` for explicit audit clarity.
- **Extension Normalization:** The client filename is reduced to its final path component, Unicode-normalized (NFC), stripped of control characters, and evaluated using the single lowercased suffix. Double extensions (`invoice.pdf.exe`) and null bytes are rejected outright.
- **Display Name Sanitization:** Logical names stored in PostgreSQL are capped at 150 characters and are fully decoupled from the physical object key (see Section 4).

### Verification

- **Test Case:** Uploaded `webshell.php`, `xss.svg`, `exploit.html`, `document.pdf.exe`, and a filename containing a null byte.
- **Expected & Observed Result:** Server rejected each payload with HTTP `400 Bad Request` before opening the upload stream, and recorded an `UPLOAD_BLOCKED` entry with the rejection reason in `audit_logs`.

---

## 2. File Content & Magic-Byte MIME Validation

### Threat Vector
HTTP `Content-Type` headers and file extensions are fully attacker-controlled. An attacker can rename a PHP script or HTML/JavaScript payload to `invoice.pdf` or `avatar.png` and send `Content-Type: image/png` to bypass naive validation.

### Implemented Defense
- **Binary Header Inspection:** Rather than trusting client headers, the backend reads the initial 4,096 bytes of the uploaded byte stream and inspects the binary signature (magic bytes) via `python-magic` (`libmagic`).
- **Extension-to-MIME Cross-Matrix:** The detected MIME type must belong to the exact set of permitted MIME types mapped to the file's claimed extension (e.g., `.pdf` must inspect strictly as `application/pdf`; `.png` must inspect as `image/png`).
- **Structural Image Verification:** Uploaded raster images undergo structural verification via Pillow (`Image.verify()`) to reject corrupted or disguised polyglot payloads. The verified MIME type, not the client header, is persisted in `FileRecord.detected_mime_type`.

### Verification
- **Test Case:** Created a file containing `<?php echo shell_exec($_GET['cmd']); ?>`, renamed it to `photo.png`, and submitted it with header `Content-Type: image/png`.
- **Expected & Observed Result:** `libmagic` identified the stream as `text/x-php` / `text/plain`, mismatched against `.png`'s allowed MIME (`image/png`), immediately aborted the upload with `415 Unsupported Media Type`, and logged the spoofing attempt as `UPLOAD_BLOCKED`.

---

## 3. Path Traversal Prevention

### Threat Vector
If user-supplied filenames or folder paths are concatenated with a storage directory (e.g., `uploads/ + filename`), payloads containing `../` or `..\` allow attackers to overwrite critical system files, read sensitive configuration files (`.env`), or escape their isolated storage directory.

### Implemented Defense
- **Zero User Input in Filesystem Paths:** Logical folder hierarchy exists exclusively as relational foreign keys in PostgreSQL (`Folder.parent_id`), never as OS directories.
- **Strict Storage Key Validation:** All disk operations validate that the storage identifier strictly matches a UUIDv4 regex pattern.
- **Canonical Path Confinement:** Every resolved disk path is verified with `resolved_path = (STORAGE_ROOT / prefix / key).resolve()` followed by an invariant check `resolved_path.is_relative_to(STORAGE_ROOT.resolve())`. Any violation raises `SecurityViolationError`, which is handled globally with a generic `400` and a `PATH_TRAVERSAL_BLOCKED` audit entry.
- **Logical Name Hardening:** Folder and file display schemas reject control characters, `/`, `\`, `..`, drive prefixes, trailing dots/spaces, and Windows reserved device names before any persistence.

### Verification
- **Test Case:** Submitted filenames `../../../../etc/passwd`, `..%2F..%2F.env`, and `..\secret.txt` across upload and rename endpoints.
- **Expected & Observed Result:** Traversal characters were rejected at schema validation; storage layer confinement independently guarantees that no file operation can ever escape `/var/lib/sfmp_vault`.

---

## 4. Cryptographic Randomized File Naming

### Threat Vector
Storing uploaded files under user-chosen filenames introduces multiple risks: predictable file URLs, race-condition overwrites between users, OS-specific reserved filename bugs (e.g., `CON`, `NUL`, Unicode homoglyphs), and accidental handler mapping based on file extensions on disk.

### Implemented Defense
- **Full Decoupling:** User-facing names reside strictly in PostgreSQL (`FileRecord.original_filename`). Physical files on disk are stored under server-generated cryptographic `UUIDv4` keys (122 bits of entropy) inside 2-character sharded directories (e.g., `/var/lib/sfmp_vault/9f/9f8b...`).
- **Extensionless Storage:** Physical files are written **without any file extension**, ensuring neither the OS nor any auxiliary daemon associates an executable handler with stored blobs. The upload path independently asserts `target.suffix == ""` and refuses to overwrite an existing object key.
- **Integrity Fingerprinting:** Every uploaded file's `SHA-256` digest is computed during streaming and stored alongside metadata for integrity verification.

### Verification
- **Test Case:** Uploaded two distinct files identically named `quarterly-report.pdf` into the same account/different folders and inspected the vault.
- **Expected & Observed Result:** Both files stored cleanly without collision under separate extensionless UUIDv4 filenames, while downloading restored the exact original filename via HTTP headers.

---

## 5. Preventing Unauthorized Cross-User File Access (Anti-IDOR)

### Threat Vector
Insecure Direct Object Reference (IDOR / OWASP API1) occurs when an authenticated user modifies a resource identifier (`file_id`, `folder_id`, or `share_id`) in an API request to read, download, rename, share, or delete another user's private files.

### Implemented Defense
- **Non-Sequential Identifiers:** All primary keys (`User`, `Folder`, `FileRecord`, `ShareLink`) use `UUIDv4` rather than auto-incrementing integers, preventing blind enumeration.
- **Mandatory Ownership Scoped Queries:** Every single file and folder endpoint injects a FastAPI authorization dependency (`get_owned_file`, `get_owned_folder`, `get_owned_share`) that derives `user_id` exclusively from the cryptographically verified JWT and queries `WHERE id = :resource_id AND owner_id = :current_user_id`.
- **Non-Leaking Error Responses:** Unauthorized access attempts return `404 Not Found` (preventing attackers from probing whether a given UUID belongs to another tenant) while recording an internal `ACCESS_DENIED` event in `audit_logs`. Non-admin access to the admin console is audited as well.
- **Token-Hashed Public Shares:** Public access is permitted *only* via `/api/v1/public/share/{token}`, where the presented 256-bit token is SHA-256 hashed and checked against expiry, revocation, and download caps.

### Verification
- **Test Case:** Created User A and User B. User A uploaded a private file (`file_id_A`). Authenticated as User B, attempted `GET /download`, `PATCH /rename`, `POST /share`, and `DELETE` against `file_id_A`.
- **Expected & Observed Result:** Every request returned `404` with zero data disclosure, and each unauthorized probe was captured in the admin audit trail.

---
