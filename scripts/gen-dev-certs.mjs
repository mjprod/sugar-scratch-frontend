#!/usr/bin/env node
/**
 * Generate (or refresh) local HTTPS certs for Vite so phones on the same
 * Wi‑Fi can open https://<lan-ip>:5173 without a scary invalid-cert wall.
 *
 * Requires: mkcert (https://github.com/FiloSottile/mkcert)
 *   brew install mkcert nss
 *   mkcert -install
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const certDir = path.join(rootDir, "certs");
const certFile = path.join(certDir, "dev-cert.pem");
const keyFile = path.join(certDir, "dev-key.pem");

function which(bin) {
  try {
    return execSync(`command -v ${bin}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function lanIpv4s() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.internal) continue;
      // Node may report family as 4 / "IPv4"
      const family = String(entry.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(entry.address)
      ) {
        ips.push(entry.address);
      }
    }
  }
  return [...new Set(ips)];
}

const mkcert = which("mkcert");
if (!mkcert) {
  console.error(`
mkcert is not installed.

  macOS:  brew install mkcert nss && mkcert -install
  then:   npm run certs
`);
  process.exit(1);
}

fs.mkdirSync(certDir, { recursive: true });

// Trust the local CA once (safe / idempotent).
try {
  execFileSync(mkcert, ["-install"], { stdio: "inherit" });
} catch (err) {
  console.warn("[certs] mkcert -install failed (may need sudo once):", err?.message || err);
}

const hosts = ["localhost", "127.0.0.1", "::1", ...lanIpv4s()];
console.info("[certs] generating for:", hosts.join(", "));

execFileSync(
  mkcert,
  ["-cert-file", certFile, "-key-file", keyFile, ...hosts],
  { stdio: "inherit" },
);

console.info(`
[certs] wrote:
  ${path.relative(rootDir, certFile)}
  ${path.relative(rootDir, keyFile)}

Start the app with:  npm run dev
On your phone (same Wi‑Fi), open:
${lanIpv4s()
  .map((ip) => `  https://${ip}:5173`)
  .join("\n") || "  https://<your-lan-ip>:5173"}

Note: the phone must trust the mkcert CA (on the same machine that ran
\`mkcert -install\`, or install the CA profile on the device).
If the LAN IP changes, re-run: npm run certs
`);
