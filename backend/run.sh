#!/usr/bin/env bash
# Start SmartSeen backend on port 8083.
# Usage: ./run.sh   or   bash run.sh
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8083}"

if command -v poetry &>/dev/null; then
  poetry run uvicorn app.main:app --reload --port "$PORT"
  exit 0
fi
if command -v uvicorn &>/dev/null; then
  uvicorn app.main:app --reload --port "$PORT"
  exit 0
fi
if python3 -c "import uvicorn" 2>/dev/null; then
  python3 -m uvicorn app.main:app --reload --port "$PORT"
  exit 0
fi

echo "No uvicorn found. Install dependencies first:"
echo "  cd $(pwd)"
echo "  poetry install"
echo "  poetry run uvicorn app.main:app --reload --port $PORT"
echo ""
echo "Or with pip: pip install uvicorn fastapi sqlalchemy pydantic pydantic-settings python-jose passlib pydantic-settings"
echo "  python3 -m uvicorn app.main:app --reload --port $PORT"
exit 1
