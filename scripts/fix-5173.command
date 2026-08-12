#!/bin/bash
cd /Users/glaucomp/sugar_scratchie/frontend-new
echo "Killing stuck Vite on :5173…"
for port in $(seq 5173 5190); do
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  [ -n "${pids:-}" ] && kill -9 $pids 2>/dev/null || true
done
sleep 1
echo "Starting fixed app on http://localhost:5173 …"
npm run dev
