#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="${OUTPUT_DIR:-output}"
PORT="${PORT:-3000}"
BASE_URL="${BASE_URL:-http://localhost:${PORT}}"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/wrangler-logs"

export WRANGLER_LOG_PATH="$OUTPUT_DIR/wrangler-logs"
export CHOKIDAR_USEPOLLING="${CHOKIDAR_USEPOLLING:-1}"
export CHOKIDAR_INTERVAL="${CHOKIDAR_INTERVAL:-1000}"

echo "Starting dev server on ${BASE_URL}..."
WRANGLER_INSPECTOR_PORT="${WRANGLER_INSPECTOR_PORT:-0}"
npx wrangler pages dev --proxy "$PORT" --ip 127.0.0.1 --inspector-port "$WRANGLER_INSPECTOR_PORT" -- npm run dev:frontend > "$OUTPUT_DIR/dev_server.log" 2>&1 &
DEV_PID=$!

cleanup() {
  echo "Stopping dev server (pid $DEV_PID)..."
  kill "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server
printf "Waiting for server"
for i in {1..60}; do
  if curl -fsS "$BASE_URL" >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  printf "."
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "\nServer did not become ready in time. Check $OUTPUT_DIR/dev_server.log"
    exit 1
  fi
done

# Run UI E2E test
python ui_acceptance_test.py
