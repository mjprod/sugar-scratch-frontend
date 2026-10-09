#!/usr/bin/env node
/**
 * Fails the build when first-load JS (the entry script plus every
 * modulepreload in dist/index.html) or first-load CSS grows past its gzip
 * budget, or when a
 * lazy-only chunk (three, lottie, framer-motion features, auth overlays) is
 * preloaded on every page again, or when lab pages ship without VITE_ENABLE_LABS.
 *
 * Usage: node scripts/check-bundle-budget.mjs  (run after `vite build`)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { loadEnv } from "vite";

const DIST = "dist";
const FIRST_LOAD_JS_BUDGET_KB = 195;
const FIRST_LOAD_CSS_BUDGET_KB = 60;
const FORBIDDEN_PRELOADS = [
  /\/three-[\w-]+\.js$/,
  /\/lottie-[\w-]+\.js$/,
  /\/motionFeatures-[\w-]+\.js$/,
  /\/(AuthenticationSheet|VerifyEmailModal|SearchScreen)-[\w-]+\.js$/,
];
const LAB_CHUNKS =
  /^(ComponentLabPage|PreLoaderPage|CoverFlowV2Page|MobileCarouselPage|GameUiPage|AudioTestPage)-[\w-]+\.js$/;

const indexPath = join(DIST, "index.html");
if (!existsSync(indexPath)) {
  console.error(`[bundle-budget] ${indexPath} not found — run the build first.`);
  process.exit(1);
}

const html = readFileSync(indexPath, "utf8");
const jsUrls = new Set();
const cssUrls = new Set();
for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) jsUrls.add(m[1]);
for (const m of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) jsUrls.add(m[1]);
for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) cssUrls.add(m[1]);

const gzKb = (url) => gzipSync(readFileSync(join(DIST, url.replace(/^\//, "")))).length / 1024;

const rows = [...jsUrls].map((url) => ({ url, kb: gzKb(url) }));
const totalJs = rows.reduce((sum, r) => sum + r.kb, 0);
const totalCss = [...cssUrls].reduce((sum, url) => sum + gzKb(url), 0);

for (const r of rows.sort((a, b) => b.kb - a.kb)) {
  console.log(`  ${r.kb.toFixed(1).padStart(7)} KB gz  ${r.url}`);
}
console.log(
  `[bundle-budget] first-load JS ${totalJs.toFixed(1)} KB gz (budget ${FIRST_LOAD_JS_BUDGET_KB}), ` +
    `CSS ${totalCss.toFixed(1)} KB gz (budget ${FIRST_LOAD_CSS_BUDGET_KB})`,
);

const failures = [];
if (totalJs > FIRST_LOAD_JS_BUDGET_KB) {
  failures.push(`first-load JS ${totalJs.toFixed(1)} KB gz exceeds ${FIRST_LOAD_JS_BUDGET_KB} KB`);
}
if (totalCss > FIRST_LOAD_CSS_BUDGET_KB) {
  failures.push(`first-load CSS ${totalCss.toFixed(1)} KB gz exceeds ${FIRST_LOAD_CSS_BUDGET_KB} KB — page CSS belongs next to its lazy route`);
}
for (const url of jsUrls) {
  if (FORBIDDEN_PRELOADS.some((re) => re.test(url))) {
    failures.push(`${url} is preloaded by index.html — it must stay behind a lazy route`);
  }
}
if (loadEnv("production", process.cwd(), "VITE_").VITE_ENABLE_LABS !== "1") {
  for (const name of readdirSync(join(DIST, "assets"))) {
    if (LAB_CHUNKS.test(name)) {
      failures.push(`assets/${name} is a lab page — keep its import() behind LABS_ENABLED`);
    }
  }
}

if (failures.length) {
  for (const f of failures) console.error(`[bundle-budget] FAIL: ${f}`);
  process.exit(1);
}
console.log("[bundle-budget] OK");
