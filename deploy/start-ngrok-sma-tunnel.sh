#!/usr/bin/env bash
# Ensure the SMA ngrok tunnel exists; print and persist the public URL.
# pm2 restart of sma-api does NOT change this URL. The URL only changes if the
# ngrok agent restarts or the "sma" tunnel is deleted and recreated without a reserved domain.
set -euo pipefail

ROOT="${SMA_ROOT:-$HOME/Documents/sma}"
URL_FILE="$ROOT/ngrok-url.txt"
PREV=""
if [[ -f "$URL_FILE" ]]; then
  PREV=$(cat "$URL_FILE" | tr -d '[:space:]')
fi

mkdir -p "$ROOT"

get_sma_url() {
  curl -fsS http://127.0.0.1:4040/api/tunnels | python3 -c "
import sys, json
for t in json.load(sys.stdin).get('tunnels', []):
    if t.get('name') == 'sma' or str(t.get('config', {}).get('addr', '')).endswith(':8083'):
        print(t.get('public_url', ''))
        break
"
}

URL=$(get_sma_url || true)
if [[ -z "${URL}" ]]; then
  curl -fsS -X POST http://127.0.0.1:4040/api/tunnels \
    -H 'Content-Type: application/json' \
    -d '{"name":"sma","addr":"http://localhost:8083","proto":"http"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('public_url',''))" >/dev/null || true
  sleep 1
  URL=$(get_sma_url || true)
fi

if [[ -z "${URL}" ]]; then
  echo "ERROR: could not resolve SMA ngrok URL" >&2
  exit 1
fi

echo "$URL" > "$URL_FILE"
echo "$URL"

if [[ -n "$PREV" && "$PREV" != "$URL" ]]; then
  echo "WARNING: ngrok URL CHANGED" >&2
  echo "  was: $PREV" >&2
  echo "  now: $URL" >&2
  echo "Update frontend VITE_API_URL to ${URL}/api/v1 then rebuild cpanel." >&2
  echo "$URL" > "$ROOT/ngrok-url.CHANGED"
fi
