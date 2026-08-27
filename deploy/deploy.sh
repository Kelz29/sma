#!/usr/bin/env bash
# Redeploy SmartSeen SMA backend from GitHub main.
# Keeps production .env and .venv; refreshes app code + deps; restarts pm2.
set -euo pipefail

ROOT="${SMA_ROOT:-$HOME/Documents/sma}"
REPO="$ROOT/repo"
APP="$ROOT/backend"
BRANCH="${SMA_BRANCH:-main}"
LOG="$ROOT/logs/deploy.log"

mkdir -p "$ROOT/logs"
exec >>"$LOG" 2>&1
echo "===== $(date -Is) deploy start ====="

if [[ ! -d "$REPO/.git" ]]; then
  echo "Cloning Kelz29/sma…"
  git clone --branch "$BRANCH" https://github.com/Kelz29/sma.git "$REPO"
fi

cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "Checked out $(git rev-parse --short HEAD)"

# Keep the on-server entrypoint in sync with the repo
if [[ -f "$REPO/deploy/deploy.sh" ]]; then
  cp "$REPO/deploy/deploy.sh" "$ROOT/deploy.sh"
  chmod +x "$ROOT/deploy.sh"
fi
if [[ -f "$REPO/deploy/start-ngrok-sma-tunnel.sh" ]]; then
  cp "$REPO/deploy/start-ngrok-sma-tunnel.sh" "$ROOT/start-ngrok-sma-tunnel.sh"
  chmod +x "$ROOT/start-ngrok-sma-tunnel.sh"
fi

# Preserve secrets + venv
rsync -a --delete \
  --exclude '.venv/' \
  --exclude '.env' \
  --exclude 'sma.db' \
  --exclude 'test_sma.db' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.pytest_cache/' \
  --exclude 'uploads/' \
  "$REPO/backend/" "$APP/"

# Ensure uploads dir exists
mkdir -p "$APP/uploads"

cd "$APP"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -U pip wheel
if [[ -f requirements-prod.txt ]]; then
  pip install -q -r requirements-prod.txt
else
  pip install -q \
    "fastapi>=0.111.0" "uvicorn[standard]>=0.29.0" "sqlalchemy>=2.0.29" \
    "alembic>=1.13.1" "python-jose>=3.3.0" "passlib[bcrypt]>=1.7.4" \
    "pydantic>=2.7.0" "pydantic-settings>=2.3.0" "python-multipart>=0.0.9" \
    "structlog>=24.1.0" "weasyprint>=68.0" "redis>=5.0" "pymysql>=1.1.0" \
    "cryptography" "email-validator" "httpx"
  pip freeze > requirements-prod.txt
fi

# Ensure smartseen CORS is present in .env (idempotent)
if [[ -f .env ]] && ! grep -q 'app.smartseen.co.za' .env; then
  # CORS regex in code covers *.smartseen.co.za; keep explicit origins for clarity
  sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://app.smartseen.co.za,https://smartseen.co.za,https://www.smartseen.co.za,http://localhost:5173,http://127.0.0.1:5173|' .env || true
fi

pm2 restart sma-api --update-env
sleep 2
curl -sf -o /dev/null -w "health:%{http_code}\n" http://127.0.0.1:8083/health || {
  echo "Health check failed"
  pm2 logs sma-api --lines 40 --nostream || true
  exit 1
}

# Re-attach / report SMA ngrok URL (pm2 restart alone does not change this)
if [[ -x "$ROOT/start-ngrok-sma-tunnel.sh" ]]; then
  echo "ngrok:"
  "$ROOT/start-ngrok-sma-tunnel.sh" || true
fi

echo "===== $(date -Is) deploy ok ====="
