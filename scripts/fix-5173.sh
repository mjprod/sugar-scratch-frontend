#!/bin/bash
# Kill stuck Vite processes pinning :5173–:5190, then start frontend-new on :5173.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Stopping listeners on 5173-5190…"
for port in $(seq 5173 5190); do
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "${pids:-}" ]; then
    echo "  :$port -> kill $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done
sleep 1

if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: :5173 still busy. Run: lsof -nP -iTCP:5173 -sTCP:LISTEN"
  exit 1
fi

echo "Starting Vite on https://localhost:5173 (and https://<lan-ip>:5173) …"
exec npx vite --port 5173 --strictPort --host 0.0.0.0
