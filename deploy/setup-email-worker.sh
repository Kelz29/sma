#!/usr/bin/env bash
# Ensure Redis + pm2 sma-email-worker on the home server (idempotent).
# SMTP_* must already be set in ~/Documents/sma/backend/.env — never commit secrets.
set -euo pipefail

APP="${SMA_ROOT:-$HOME/Documents/sma}/backend"
cd "$APP"

if ! command -v redis-cli >/dev/null 2>&1; then
  echo "redis-cli not found; install redis-server first" >&2
  exit 1
fi
redis-cli ping >/dev/null

# Prefer DB index 1 for SMA
if ! grep -q '^REDIS_URL=' .env 2>/dev/null; then
  echo 'REDIS_URL=redis://127.0.0.1:6379/1' >> .env
fi
if ! grep -q '^CELERY_BROKER_URL=' .env 2>/dev/null; then
  echo 'CELERY_BROKER_URL=redis://127.0.0.1:6379/1' >> .env
fi
if ! grep -q '^APP_BASE_URL=' .env 2>/dev/null; then
  echo 'APP_BASE_URL=https://app.smartseen.co.za' >> .env
fi

source .venv/bin/activate
pip install -q "celery[redis]>=5.4.0" "redis>=5.0"

if pm2 describe sma-email-worker >/dev/null 2>&1; then
  pm2 restart sma-email-worker --update-env
else
  pm2 start "$APP/.venv/bin/celery" \
    --name sma-email-worker \
    --cwd "$APP" \
    --interpreter none \
    -- \
    -A app.workers.celery_app.celery worker -Q sma_email -c 2 -l INFO
fi
pm2 save || true
echo "sma-email-worker ready"
pm2 describe sma-email-worker | head -20
