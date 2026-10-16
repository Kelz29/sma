#!/usr/bin/env bash
# Build the SmartSeen frontend from GitHub main and upload it to cPanel.
# Bakes the current SMA ngrok URL into VITE_API_URL.
# Keeps FTP credentials in $SMA_ROOT/frontend-ftp.env (never in git).
set -euo pipefail

ROOT="${SMA_ROOT:-$HOME/Documents/sma}"
REPO="$ROOT/repo"
APP="$ROOT/frontend"
SECRETS="$ROOT/frontend-ftp.env"
BRANCH="${SMA_BRANCH:-main}"
LOG="$ROOT/logs/deploy-frontend.log"

mkdir -p "$ROOT/logs"
exec > >(tee -a "$LOG") 2>&1
echo "===== $(date -Is) frontend deploy start ====="

if [[ ! -d "$REPO/.git" ]]; then
  echo "Cloning Kelz29/sma…"
  git clone --branch "$BRANCH" https://github.com/Kelz29/sma.git "$REPO"
fi

cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "Checked out $(git rev-parse --short HEAD)"

install -m 755 "$REPO/deploy/deploy-frontend.sh" "$ROOT/deploy-frontend.sh"
if [[ -f "$REPO/deploy/start-ngrok-sma-tunnel.sh" ]]; then
  install -m 755 "$REPO/deploy/start-ngrok-sma-tunnel.sh" "$ROOT/start-ngrok-sma-tunnel.sh"
fi

if [[ ! -f "$SECRETS" ]]; then
  echo "Missing $SECRETS" >&2
  echo "Copy deploy/frontend-ftp.env.example there and fill FTP_HOST and FTP_PASSWORD." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "$SECRETS"
set +a
if [[ -z "${FTP_HOST:-}" ]]; then
  echo "FTP_HOST is empty in $SECRETS" >&2
  echo "app.smartseen.co.za is behind Cloudflare, so FTP needs the Afrihost origin hostname or IP." >&2
  echo "cPanel → FTP Accounts → Configure FTP Client → FTP Server." >&2
  exit 1
fi

if [[ ! -x "$ROOT/start-ngrok-sma-tunnel.sh" ]]; then
  echo "Missing $ROOT/start-ngrok-sma-tunnel.sh" >&2
  exit 1
fi
URL=$("$ROOT/start-ngrok-sma-tunnel.sh" | tail -n1 | tr -d '[:space:]')
if [[ "$URL" != https://* ]]; then
  echo "Could not read SMA ngrok URL (got: ${URL:-empty})" >&2
  exit 1
fi
API="${URL%/}/api/v1"
echo "$API" > "$ROOT/frontend-api-url.txt"
echo "VITE_API_URL=$API"

rsync -a --delete \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.*' \
  "$REPO/frontend/" "$APP/"

cd "$APP"
if [[ ! -f package-lock.json ]]; then
  echo "frontend/package-lock.json is missing; npm ci needs it." >&2
  exit 1
fi
npm ci
VITE_API_URL="$API" npm run build
if [[ ! -f dist/index.html ]]; then
  echo "Build did not produce dist/index.html" >&2
  exit 1
fi
cp "$REPO/deploy/cpanel.htaccess" dist/.htaccess

python3 "$REPO/deploy/upload_ftp.py" "$APP/dist"

echo "===== $(date -Is) frontend deploy ok ($API) ====="
