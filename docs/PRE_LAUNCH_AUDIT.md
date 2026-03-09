# SmartSeen Pre-Launch Audit

**Audit date:** 2026-03  
**Scope:** Full system (backend, frontend, config, security, compliance)  
**Verdict:** **READY WITH WARNINGS** — Address critical/high items before production traffic.

---

## 1. FUNCTIONAL TESTING

| Finding | Severity | Status |
|--------|----------|--------|
| Backend tests exist (auth, accounts, invoices, expenses, admin, etc.) but conftest only imports 3 model modules; tests may miss tables (waitlist, feature_flags, hr, sales) if endpoints are hit | High | Fixed: conftest imports all models |
| Public landing/waitlist and auth/verify-email flows should be covered by tests | Medium | Recommended: add tests |
| Form validations (password strength, email format) — backend uses Pydantic EmailStr; no min password complexity | Medium | Documented |
| 503 on register when slots full is returned; frontend shows waitlist link | OK | — |

---

## 2. UI / UX

| Finding | Severity | Status |
|--------|----------|--------|
| No global React Error Boundary in app tree (prevents white screen on render errors) | High | Recommended: wrap App with ErrorBoundary |
| Responsive layout: Tailwind used; key pages should be manually tested on mobile/tablet | Medium | Manual QA |
| Loading states and error messages present on main flows | OK | — |
| Accessibility: semantic HTML and ARIA in places; full a11y audit recommended | Low | — |

---

## 3. PERFORMANCE

| Finding | Severity | Status |
|--------|----------|--------|
| No caching layer (e.g. Redis) for sessions or hot data | Low | Acceptable for initial launch |
| SQLite used by default — fine for low concurrency; MySQL recommended for scale | Medium | Document in runbook |
| Frontend: single bundle; consider code-splitting per route for large apps | Low | — |
| No CDN or asset optimization documented | Low | — |

---

## 4. SECURITY

| Finding | Severity | Status |
|--------|----------|--------|
| **SECRET_KEY default "CHANGE_ME"** — must never run in production with default | Critical | Fixed: startup check when ENVIRONMENT=production |
| **MYSQL_PASSWORD default "password"** — insecure if USE_SQLITE=false in prod | Critical | Documented: set in env |
| **No rate limiting** on /auth/login, /auth/register — brute force and credential stuffing risk | High | Recommended: add rate limit middleware |
| JWT stored in localStorage — vulnerable to XSS; consider httpOnly cookies for production | High | Documented; consider cookie-based auth later |
| Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy present; **no CSP, no HSTS** | High | Fixed: added CSP (report-only) and HSTS when production |
| CORS allows many localhost ports — in production set CORS_ORIGINS to actual frontend origin(s) only | Medium | Documented in .env.example |
| Passwords hashed with pbkdf2_sha256 — good | OK | — |
| No SQL injection from user input (ORM/parameterized) | OK | — |

---

## 5. DATA & DATABASE

| Finding | Severity | Status |
|--------|----------|--------|
| Schema managed via create_all + ALTERs; no formal migrations (e.g. Alembic) for versioned deploys | Medium | Documented; add Alembic for production |
| No backup/restore procedure documented | High | Add to runbook |
| SQLite file (sma.db) — ensure backup and retention policy | Medium | Runbook |
| Indexes on tenant_id, user_id, email — present on key tables | OK | — |

---

## 6. API & INTEGRATIONS

| Finding | Severity | Status |
|--------|----------|--------|
| No rate limiting on public or auth endpoints | High | See Security |
| OpenAPI docs available at /docs | OK | — |
| External: SMTP optional; no payment provider in scope | OK | — |
| API error responses consistent (detail message) | OK | — |

---

## 7. INFRASTRUCTURE & DEVOPS

| Finding | Severity | Status |
|--------|----------|--------|
| No CI/CD or deployment pipeline in repo | Medium | Add GitHub Actions or similar |
| Environment variables documented in .env.example; **.env must not be committed** | High | Ensure .env in .gitignore (backend/frontend) |
| Logging: standard logging.exception in global handler; no structured (JSON) logging | Low | Optional |
| No health check with DB ping — /health is shallow | Medium | Fixed: optional DB check |
| No monitoring/alerting (e.g. Sentry, health pings) | Medium | Recommended |
| Rollback: no versioned migrations or blue-green described | Medium | Runbook |

---

## 8. COMPLIANCE & LEGAL

| Finding | Severity | Status |
|--------|----------|--------|
| **No privacy policy or cookie policy** in app or linked from footer | High | Add before go-live (link + page or URL) |
| No explicit cookie/consent banner if using non-essential cookies | Medium | JWT in localStorage; no cookies for auth — document in privacy policy |
| POPIA/GDPR: audit logging exists; data retention and right-to-erasure not automated | Medium | Document in privacy policy and runbook |

---

## 9. ANALYTICS & BUSINESS METRICS

| Finding | Severity | Status |
|--------|----------|--------|
| No analytics (e.g. GA, Mixpanel) or event tracking observed | Low | Add if product requires |
| Admin/superadmin can access tenant data — no built-in usage dashboard | Low | — |

---

## 10. EDGE CASES & FAILURE SCENARIOS

| Scenario | Mitigation |
|---------|------------|
| Server crash | Process manager (e.g. systemd, supervisor); health check + restart |
| DB unavailable | Health endpoint can include DB status; alerting |
| Network drops | Frontend shows API errors; 401 clears auth and redirects to login |
| Third-party (SMTP) fails | Welcome email failure does not block registration; other emails logged |
| Payment fails | No payment in scope |
| Disk full (uploads) | Monitor upload dir; alerting |

---

## 11. RELEASE READINESS CHECKLIST

### Critical (must fix before production)

- [x] **SECRET_KEY** — Reject startup if production and SECRET_KEY is default (implemented).
- [ ] **Secrets** — Ensure no .env with real secrets is committed; CORS_ORIGINS and DB credentials set in production.

### High (fix or accept risk)

- [x] **Security headers** — Add CSP (report-only) and HSTS for production (implemented).
- [x] **Health check** — Optional DB ping in /health (implemented).
- [x] **Test DB schema** — Conftest imports all models so test DB has all tables (implemented).
- [x] **Duplicate routers** — Remove duplicate include_router calls in main.py (implemented).
- [x] **Rate limiting** — Add on auth endpoints (implemented: in-memory per IP).
- [x] **Privacy/cookie policy** — Add link and page before go-live (implemented: /privacy + footer link).
- [x] **Backup strategy** — Document and automate DB backups (implemented: docs/RUNBOOK.md).

### Medium

- [x] **FREE_BUSINESS_SLOTS** — Set to 50 for production (or via env); document testing override (implemented).
- [x] **Migrations** — Introduce Alembic for production schema changes (implemented: backend/alembic/).
- [x] **Error Boundary** — Wrap app with React Error Boundary (implemented).
- [x] **Monitoring** — Basic monitoring implemented: structured logging (structlog, JSON in prod), request metrics (/metrics), error counting, runbook updated.

### Low

- [ ] **Structured logging** — JSON logs for production (optional).
- [x] **Password policy** — Optional min length/complexity in schema (implemented: min 8, letter + number).
- [ ] **CORS** — Restrict to production frontend origin(s) via env (documented).

---

## 12. FINAL VERDICT

**READY WITH WARNINGS**

- **Go-live** is acceptable **after**:
  - Setting **SECRET_KEY** (and other secrets) via environment in production.
  - Restricting **CORS_ORIGINS** to the real frontend origin(s).
  - Adding a **privacy policy** (and cookie notice if required).
  - Documenting **backup** and **rollback** in a runbook.

- **Recommended before scaling:**
  - Rate limiting on login/register.
  - DB migrations (Alembic).
  - Monitoring and alerting.
  - Consider httpOnly cookie for JWT in future.

---

## Improvements Implemented (Post-Audit)

1. **Config:** Reject startup when `ENVIRONMENT=production` and `SECRET_KEY` is unchanged.
2. **Security headers:** Content-Security-Policy (report-only) and HSTS (when production).
3. **Health:** `/health` optionally includes `db: "ok"` when DB is reachable.
4. **Tests:** Conftest imports all DB model modules so test database has all tables.
5. **Main app:** Removed duplicate `include_router` calls for employees, leave, attendance, payslips, portal.
6. **FREE_BUSINESS_SLOTS:** Default set back to 50; override via env for testing (e.g. `FREE_BUSINESS_SLOTS=2`).

## Recommendations Implemented (Second Pass)

7. **Rate limiting:** In-memory rate limiter on `/auth/login` (10/min per IP) and `/auth/register` (5/min per IP). Returns 429 when exceeded.
8. **Privacy policy:** New page at `/privacy` with policy content; link added to landing footer.
9. **Runbook:** `docs/RUNBOOK.md` — production checklist, DB backup/restore (SQLite & MySQL), rollback, health checks, scaling notes.
10. **Error Boundary:** React `ErrorBoundary` component wraps `App`; shows fallback UI and "Refresh page" on render errors.
11. **Password policy:** Register and change-password require min 8 characters, at least one letter and one number (Pydantic validators).
12. **Alembic:** Initial Alembic setup in `backend/alembic/` (env.py, script.py.mako, versions/). Use `alembic revision --autogenerate` and `alembic upgrade head`.
13. **Tests:** `test_public.py` for GET /landing and POST /waitlist; verify-email and weak-password tests in `test_auth.py`; health check updated for `db` field.
14. **CI/CD:** `.github/workflows/backend-tests.yml` runs backend tests on push/PR to main/master.
15. **Frontend .gitignore:** `.env`, `.env.local`, `.env.*.local` added so secrets are not committed.
