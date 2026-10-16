#!/usr/bin/env bash
# Enable repo git hooks (pre-push tests + cpanel build).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
git -C "$ROOT" config core.hooksPath .githooks
chmod +x "$ROOT/.githooks/"* "$ROOT/scripts/"*.sh "$ROOT/deploy/"*.sh 2>/dev/null || true
echo "Configured core.hooksPath=.githooks"
git -C "$ROOT" config --get core.hooksPath
