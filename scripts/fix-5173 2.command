#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

exec bash scripts/fix-5173.sh
