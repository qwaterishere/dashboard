#!/usr/bin/env bash
# Start FastAPI for Playwright e2e (local + CI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/backend"

python3 -m pip install -q -r requirements/dev.txt

export DB_URL="${DB_URL:-sqlite:///$ROOT/backend/e2e-dashboard.db}"
export RATE_LIMIT_ENABLED="${RATE_LIMIT_ENABLED:-false}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:4200}"

exec python3 -m uvicorn src.main:app --host 127.0.0.1 --port 8000
