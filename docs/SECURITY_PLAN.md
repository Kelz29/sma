# SmartSeen Security Plan & Compliance Roadmap

**Document owner:** Cyber Security / Engineering  
**Handover:** Top 1% Senior Software Engineer — implement all items in **Phase 2** and **Phase 3** as specified.  
**Last updated:** 2025-03

---

## 1. Executive Summary

This plan makes the SmartSeen system **rock solid** and **highly compliant** by:

1. **Assessing** current posture (done).
2. **Running** necessary security tests (pen test scope, SAST/DAST, dependency audit).
3. **Hardening** the application (backend + frontend) and fixing findings.
4. **Handing over** a prioritized implementation list to a senior engineer.
5. **Implementing** critical and high-priority items in code (partially done in this pass).

Target compliance touchpoints: **OWASP Top 10**, **CWE**-relevant mitigations, and baseline for **SOC 2 / GDPR** (data handling, audit, access control).

---

## 2. Threat Model (Summary)

| Threat | Likelihood | Impact | Mitigation |
|--------|-------------|--------|------------|
| Credential stuffing / brute force on login | High | High | Rate limiting on auth endpoints, strong password policy |
| Token theft / replay | Medium | High | Short-lived JWT, HTTPS only, secure storage (no localStorage for tokens in production if persisting) |
| Tenant isolation bypass | Medium | Critical | Server-side tenant check on every request (already in place); audit all endpoints |
| Information leakage via errors | Medium | Medium | Sanitize all exception messages to clients; generic 5xx messages |
| XSS / injection | Medium | High | Input validation (Pydantic), output encoding, CSP headers |
| File upload abuse (malicious files, path traversal) | Medium | High | File size limit, content-type allowlist, filename sanitization, store outside webroot |
| CORS misconfiguration | Medium | Medium | Restrict `allow_origins` to frontend origin(s) in production |
| Dependency vulnerabilities | High | Variable | Lockfile + automated audit (npm audit, pip/poetry audit) |
| Missing security headers | High | Medium | Add security headers (CSP, X-Frame-Options, etc.) |

---

## 3. Security Testing Plan

### 3.1 Penetration Test Scope

- **Authentication:** Login, logout, token handling, password reset (if any), session fixation.
- **Authorization:** Role-based access (admin, accountant, viewer, employee), tenant isolation (access other tenant’s data by ID/slug).
- **API:** All `/api/v1/*` routes — IDOR, parameter tampering, mass assignment.
- **File upload:** Receipt upload — type, size, path traversal, stored malware.
- **Business logic:** Invoice workflow, expense approval, banking links, report export.

**Deliverables:** Findings report (Critical / High / Medium / Low / Info), remediation checklist, retest after fixes.

### 3.2 Security Testing Commands (Run Regularly / in CI)

```bash
# Frontend: dependency audit
cd frontend && npm audit

# Backend: dependency audit (export lockfile then audit)
cd backend && poetry export -f requirements.txt --without-hashes | pip-audit
# Or with lockfile: ensure poetry.lock exists, then same export + pip-audit
```

### 3.3 Other Necessary Tests

| Test | Tool / Method | Owner |
|-----|----------------|-------|
| **Dependency scan** | `npm audit` (frontend), `pip audit` / `poetry export \| pip-audit` (backend) | CI / Senior Eng |
| **SAST** | Semgrep, Bandit (Python), ESLint security plugins (JS) | CI / Senior Eng |
| **DAST** | OWASP ZAP or Burp — scan staging API and frontend | Security / QA |
| **Secrets scan** | GitLeaks, truffleHog, or CI secret detection | CI |
| **Infra / config** | HTTPS only, no default credentials in prod, env from vault or secret manager | DevOps / Senior Eng |

---

## 4. Compliance Checklist (High Level)

- **OWASP Top 10:** Addressed via validation, parameterized queries (ORM), security headers, error sanitization, file upload controls, CORS, and dependency management.
- **GDPR-relevant:** Access control, audit logging (who did what), data minimization in logs and errors; document retention and right-to-erasure in runbook.
- **SOC 2:** Access control, change/audit trail, secure config (secrets, CORS), incident response (runbook).

---

## 5. Prioritized Recommendations (Handover to Senior Engineer)

### Phase 2 — Implement in Code (Priority Order)

| # | Recommendation | Location | Acceptance Criteria |
|---|----------------|----------|---------------------|
| 1 | **Do not leak internal errors to client** | Backend: all `HTTPException(detail=...)` and exception handlers | Never expose stack traces or internal messages (e.g. SMTP, DB). Use generic "Service temporarily unavailable" or similar. |
| 2 | **Add security headers** | Backend: `main.py` (middleware) | At least: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. Optional: CSP. |
| 3 | **Tighten CORS** | Backend: `config.py` + `main.py` | In production, `allow_origins` = frontend origin(s) only (e.g. from env `CORS_ORIGINS`). No `*` with `allow_credentials=True`. |
| 4 | **File upload: size + content-type** | Backend: `expenses.py` receipt upload | Enforce max file size (e.g. 10 MB) and allowlist content types (e.g. image/*, application/pdf). Reject otherwise. |
| 5 | **Rate limiting** | Backend: auth and optionally global | Rate limit login (and register) by IP (e.g. 5 req/min). Option: slowapi or custom middleware. |
| 6 | **Secrets & config** | Backend + DevOps | No default `SECRET_KEY` or DB password in code; fail fast if missing in prod. Add `.env.example` and document required vars. |
| 7 | **Dependency lockfile + audit** | Backend | Add `poetry.lock` and run `poetry export \| pip-audit` (or equivalent) in CI. Fix critical/high. |
| 8 | **Frontend: CSP / security** | Frontend: `index.html` or server | Add Content-Security-Policy meta or header if possible; ensure no inline scripts unless required. |
| 9 | **Audit logging** | Backend | Ensure all sensitive mutations (create/update/delete) call `log_audit()` with tenant, user, action, entity, IP. |
| 10 | **HTTPS and cookie flags** | Infra / config | In production, enforce HTTPS; if cookies are used later, set Secure, HttpOnly, SameSite. |

### Phase 3 — Operational & Process

| # | Recommendation | Owner |
|---|----------------|-------|
| 11 | Run full pen test (external or internal) and remediate | Security / Eng |
| 12 | Integrate dependency + SAST scans in CI | DevOps / Eng |
| 13 | Document incident response and secrets rotation | Security / Ops |
| 14 | Consider refresh token flow and token binding | Senior Eng |

---

## 6. Implementation Status (This Pass)

The following have been **implemented** in code as part of this security pass:

- **Error sanitization:** Email send failure in `invoices.py` no longer exposes exception message to client; generic 503 message used.
- **Security headers:** Middleware added in `main.py` (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- **CORS:** Configurable via `CORS_ORIGINS` in config; production should set allowed origins (no `*` with credentials).
- **File upload:** Max file size and content-type allowlist for receipt upload in `expenses.py`.
- **Config:** `RECEIPT_MAX_BYTES`, `ALLOWED_UPLOAD_CONTENT_TYPES`, `CORS_ORIGINS` added to `config.py`.
- **.env.example:** Backend `.env.example` created with required and optional variables documented.

Remaining for the **Senior Engineer**: rate limiting (auth), full audit coverage, lockfile + pip-audit in CI, frontend CSP, and operational items (pen test, CI, runbooks).

---

## 7. Acceptance Criteria for “Rock Solid & Highly Compliant”

- [ ] No critical/high findings from pen test (or documented exceptions with mitigations).
- [ ] Dependency scan in CI; no critical/high unmitigated vulnerabilities.
- [ ] All Phase 2 items (1–10) implemented and verified.
- [ ] Production uses non-default secrets and restricted CORS.
- [ ] Sensitive errors never returned to clients; security headers present.
- [ ] File upload constrained by size and type; audit log on key actions.

Once the Senior Engineer completes the above, the system will be in a strong position for compliance and production deployment.
