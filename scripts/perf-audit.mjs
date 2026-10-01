#!/usr/bin/env node
/**
 * Lighthouse performance audit across every app route (mobile, simulated 4G + 4x CPU).
 *
 *   npm run build && npx vite preview --port 4174 --strictPort
 *   node scripts/perf-audit.mjs                       # guest pass
 *   PERF_COOKIE="sugar_session=…" node scripts/perf-audit.mjs   # adds signed-in pass
 *
 * Env: PERF_BASE (default https://localhost:4174), PERF_ONLY=/,/store (subset),
 *      PERF_OUT (default .perf). Lighthouse is fetched via npx, not a dependency.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.PERF_BASE || "https://localhost:4174").replace(/\/+$/, "");
const OUT = process.env.PERF_OUT || ".perf";
const COOKIE = process.env.PERF_COOKIE || "";
const ONLY = (process.env.PERF_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

const PUBLIC_ROUTES = [
  "/",
  "/discover",
  "/store",
  "/creator/julianaval",
  "/creator/julianaval/motion/julianaval_cop",
  "/purchase/julianaval-pack-1",
  "/purchase/tear-open",
  "/coverflow-v2",
  "/mobile-carousel",
  "/game?model=julianaval&card=julianaval_cop",
  "/game-ui",
  "/photo-scratch",
  "/welcome",
  "/pre-loader",
];

const SIGNED_IN_ROUTES = [
  "/",
  "/collection",
  "/rewards",
  "/profile",
  "/profile/edit",
  "/profile/following",
  "/profile/game-settings",
  "/profile/transactions",
  "/profile/game-history",
  "/settings",
  "/inbox",
  "/pack-pocket",
  "/store",
];

const pick = (routes) => (ONLY.length ? routes.filter((r) => ONLY.includes(r)) : routes);

function slug(route, pass) {
  const s = route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_").replace(/_+$/, "") || "home";
  return `${pass}-${s}`;
}

function runLighthouse(route, pass) {
  const file = path.join(OUT, `${slug(route, pass)}.json`);
  const args = [
    "--yes",
    "lighthouse@13",
    `${BASE}${route}`,
    "--only-categories=performance",
    "--form-factor=mobile",
    "--throttling-method=simulate",
    "--chrome-flags=--headless=new --ignore-certificate-errors",
    "--max-wait-for-load=45000",
    "--output=json",
    `--output-path=${file}`,
    "--quiet",
  ];
  if (pass === "auth" && COOKIE) args.push(`--extra-headers=${JSON.stringify({ Cookie: COOKIE })}`);
  try {
    execFileSync("npx", args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (err) {
    return { route, pass, error: String(err.stderr || err.message).slice(0, 300) };
  }
  return summarize(route, pass, JSON.parse(readFileSync(file, "utf8")));
}

function summarize(route, pass, lhr) {
  const a = lhr.audits;
  const num = (id) => a[id]?.numericValue ?? null;
  const items = a["network-requests"]?.details?.items ?? [];
  const byType = {};
  for (const it of items) {
    const t = it.resourceType || "Other";
    byType[t] = (byType[t] || 0) + (it.transferSize || 0);
  }
  const largest = [...items]
    .sort((x, y) => (y.transferSize || 0) - (x.transferSize || 0))
    .slice(0, 5)
    .map((it) => ({ url: it.url.replace(BASE, ""), kb: Math.round((it.transferSize || 0) / 1024) }));
  const unusedJs = a["unused-javascript"]?.details?.overallSavingsBytes ?? 0;
  return {
    route,
    pass,
    finalUrl: lhr.finalDisplayedUrl?.replace(BASE, ""),
    runtimeError: lhr.runtimeError?.code ?? null,
    score: Math.round((lhr.categories.performance.score ?? 0) * 100),
    fcpMs: num("first-contentful-paint"),
    lcpMs: num("largest-contentful-paint"),
    tbtMs: num("total-blocking-time"),
    cls: num("cumulative-layout-shift"),
    siMs: num("speed-index"),
    ttiMs: num("interactive"),
    totalKb: Math.round((num("total-byte-weight") ?? 0) / 1024),
    requests: items.length,
    jsKb: Math.round((byType.Script || 0) / 1024),
    mediaKb: Math.round((byType.Media || 0) / 1024),
    imageKb: Math.round((byType.Image || 0) / 1024),
    unusedJsKb: Math.round(unusedJs / 1024),
    mainThreadMs: num("mainthread-work-breakdown"),
    bootupMs: num("bootup-time"),
    largest,
  };
}

mkdirSync(OUT, { recursive: true });
const plan = [
  ...pick(PUBLIC_ROUTES).map((r) => [r, "guest"]),
  ...(COOKIE ? pick(SIGNED_IN_ROUTES).map((r) => [r, "auth"]) : []),
];
const results = [];
for (const [route, pass] of plan) {
  process.stdout.write(`${pass.padEnd(5)} ${route} … `);
  const r = runLighthouse(route, pass);
  results.push(r);
  console.log(r.error ? `ERROR ${r.error.split("\n")[0]}` : `score ${r.score}  LCP ${(r.lcpMs / 1000).toFixed(1)}s  TBT ${Math.round(r.tbtMs)}ms  ${r.totalKb}KB`);
  writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(results, null, 2));
}
console.log(`\nWrote ${path.join(OUT, "summary.json")}`);
