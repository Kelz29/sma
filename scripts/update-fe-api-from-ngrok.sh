#!/usr/bin/env bash
# Fetch the live SMA ngrok URL from the home server and update frontend/.env.
# Usage: ./scripts/update-fe-api-from-ngrok.sh [ssh-host]
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOST="${1:-admin1@100.83.130.102}"
ENV_FILE="$ROOT/frontend/.env"

URL=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" \
  'bash ~/Documents/sma/start-ngrok-sma-tunnel.sh' | tail -n1 | tr -d '[:space:]')

if [[ -z "$URL" || "$URL" != https://* ]]; then
  echo "Failed to read ngrok URL from $HOST" >&2
  exit 1
fi

API="${URL%/}/api/v1"
mkdir -p "$(dirname "$ENV_FILE")"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^VITE_API_URL=' "$ENV_FILE"; then
    # portable in-place edit
    tmp=$(mktemp)
    sed "s|^VITE_API_URL=.*|VITE_API_URL=${API}|" "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "VITE_API_URL=${API}" >>"$ENV_FILE"
  fi
else
  echo "VITE_API_URL=${API}" >"$ENV_FILE"
fi

echo "Updated $ENV_FILE"
echo "VITE_API_URL=${API}"
echo "Rebuild FE for cPanel: npm --prefix frontend run build:cpanel"
