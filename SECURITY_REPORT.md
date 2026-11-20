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
