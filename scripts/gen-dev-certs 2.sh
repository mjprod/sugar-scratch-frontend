#!/bin/bash
# Generate trusted local HTTPS certs for Vite (DeviceOrientation / compass on phones).
# Requires: brew install mkcert && mkcert -install
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Install with: brew install mkcert"
  exit 1
fi

mkdir -p .certs

# Current non-loopback IPv4 addresses (LAN / Wi‑Fi).
LAN_IPS=()
while IFS= read -r ip; do
  [ -n "$ip" ] && LAN_IPS+=("$ip")
done < <(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2}')

NAMES=(localhost 127.0.0.1 ::1 "${LAN_IPS[@]}")
echo "Generating cert for: ${NAMES[*]}"

mkcert -cert-file .certs/dev-cert.pem -key-file .certs/dev-key.pem "${NAMES[@]}"

# Copy CA for phone install (AirDrop / Files). Never commit; .certs is gitignored.
CAROOT="$(mkcert -CAROOT)"
cp "$CAROOT/rootCA.pem" .certs/rootCA.pem

echo
echo "Wrote:"
echo "  .certs/dev-cert.pem"
echo "  .certs/dev-key.pem"
echo "  .certs/rootCA.pem   ← install this CA on your phone once"
echo
echo "Mac trust: mkcert -install"
echo "iOS: AirDrop rootCA.pem → Settings → General → VPN & Device Management → install,"
echo "     then Settings → General → About → Certificate Trust Settings → enable full trust."
echo "Android: Settings → Security → Install from storage → CA certificate → rootCA.pem"
echo
echo "Restart Vite (npm run dev). Phone URL: https://<lan-ip>:5173"
