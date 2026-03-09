# SmartSeen Runbook

Operational procedures for deployment, backup, rollback, and production.

---

## 1. Production checklist before go-live

- [ ] Set **ENVIRONMENT=production**
- [ ] Set **SECRET_KEY** to a strong random value (min 32 characters), e.g. `openssl rand -hex 32`
- [ ] Set **CORS_ORIGINS** to your frontend origin(s) only (e.g. `https://app.smartseen.com`)
- [ ] Configure **MYSQL_*** or keep **USE_SQLITE=true** and ensure volume/disk for `sma.db`
- [ ] Configure **SMTP_*** for transactional email (welcome, invoices)
- [ ] Set **APP_BASE_URL** to your frontend URL (e.g. `https://app.smartseen.com`) for email links
- [ ] Ensure **.env** is never committed; use secrets manager or env vars in the host

---

## 2. Database backup

### SQLite (default)

- **Location:** `./sma.db` (or path in **SQLALCHEMY_DATABASE_URI** / **DATABASE_URI_OVERRIDE**).
- **Backup:** Copy the file while the app is running (SQLite supports concurrent reads), or stop the app and copy.

```bash
# Example: daily backup
cp /path/to/sma.db /backups/sma-$(date +%Y%m%d).db
# Or with sqlite3 for a consistent snapshot (brief lock):
sqlite3 /path/to/sma.db ".backup /backups/sma-$(date +%Y%m%d).db"
```

- **Retention:** Keep at least 7 daily backups; retain weekly for a month.
- **Restore:** Stop the app, replace `sma.db` with the backup file, restart.

### MySQL

- Use `mysqldump` or your provider’s backup tool.
- **Example:** `mysqldump -u user -p sma > sma-$(date +%Y%m%d).sql`
- **Restore:** `mysql -u user -p sma < sma-YYYYMMDD.sql`
- Configure automated backups (e.g. cron, RDS snapshots).

---

## 3. Rollback strategy

### Application rollback

- **Code:** Deploy the previous version from Git (tag or commit). Use the same **SECRET_KEY** and DB so sessions remain valid.
- **Config:** Revert env or config changes that caused the issue.
- **Database:** Only restore from backup if a bad migration or data change occurred. Test restore on a copy first.

### After a bad deployment

1. Switch traffic back to the previous app version (or revert the deploy).
2. If a DB migration was applied and is incompatible, either:
   - Run a backward migration (if using Alembic and you have down-revisions), or
   - Restore DB from the last good backup (see above), then redeploy the previous app version.

---

## 4. Health checks

- **Endpoint:** `GET /health`
- **Response:** `{"status": "ok", "db": "ok"}` when the app and DB are healthy. If DB is unreachable, `"db": "error"`.
- Use this in your load balancer or monitoring (e.g. ping every 30s, alert if non-200 or `db !== "ok"`).

---

## 5. Logging and monitoring

- **Logs:** Structured logging is configured via structlog — JSON in production (ENVIRONMENT=production), readable console in development. Each request is logged (method, path, status, duration_ms, client). Unhandled exceptions are logged with context and counted.
- **Redis (optional):** Set `REDIS_URL=redis://localhost:6379/0` to use Redis for: rate limiting (shared across workers), metrics aggregation, and landing slots cache (30s TTL). If unset, the app uses in-memory rate limiting and metrics.
- **Metrics:** `GET /metrics` returns counters (from Redis if configured, else in-memory): `requests_total`, `errors_total`, `status_2xx`, `status_4xx`, `status_5xx`, `uptime_seconds`. In production, restrict access (e.g. firewall to internal only or add a simple auth).
- **Health:** `GET /health` returns `{"status": "ok", "db": "ok"}` (or `db: "error"`). Use for load balancers and uptime checks.
- **Alerts:** Configure alerts for: health check failures, 5xx rate, disk space (especially for SQLite and uploads directory). Optionally poll `/metrics` and alert when `errors_total` or `status_5xx` exceeds a threshold.

---

## 6. Scaling notes

- **SQLite:** Suitable for low concurrency. For higher load, use **USE_SQLITE=false** and MySQL (or PostgreSQL with adapter).
- **Rate limiting:** Auth endpoints use in-memory rate limiting per IP. For multiple workers, use a shared store (e.g. Redis).
- **Uploads:** Store uploads on a shared volume or object storage if running multiple app instances.

---

## 7. Data retention and compliance (GDPR / POPIA)

- **Audit log:** Backend records audit events (e.g. who changed what). Retain according to policy.
- **Right to erasure:** Implement a process to delete or anonymise a user’s data on request (manual or script using existing APIs and DB).
- **Retention:** Define and document how long you keep backups, logs, and user data; document in the Privacy Policy.
