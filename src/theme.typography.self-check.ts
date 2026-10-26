/**
 * Guardrail: scoped chrome/flow files must use the type tokens,
 * not one-off px/rem font sizes.
 * Run: npx tsx src/theme.typography.self-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = "src";

const SCOPED_PREFIXES = [
  "src/index.css",
  "src/theme.css",
  "src/components/LiquidGlassNav.css",
  "src/components/cta/",
  "src/components/layout/",
  "src/components/CurrencyBalances.tsx",
  "src/components/MobileDiamondBalance.tsx",
  "src/components/WalletBalancesPopover.tsx",
  "src/components/HolographicPackCard.tsx",
  "src/components/lock-status/",
  "src/components/home/",
  "src/components/browse/",
  "src/components/store/",
  "src/components/purchase/",
  "src/pages/CartPage.tsx",
  "src/features/packs/packs.css",
  "src/features/packs/CoverFlowCarousel.tsx",
  "src/features/packs/MobileCssCarousel.tsx",
  "src/features/packs/MobileCssCarousel.css",
  "src/features/packs/CoverflowBuyConfirm.tsx",
  "src/features/collection/",
  "src/components/collection/",
  "src/components/profile/",
  "src/components/settings/",
  "src/components/auth/",
  "src/components/search/",
  "src/components/inbox/",
  "src/components/rewards/",
  "src/components/welcome/",
  "src/components/history/",
  "src/routes/RouteChunkFallback.tsx",
];

function inScope(rel: string) {
  return SCOPED_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    const rel = p.replace(/\\/g, "/");
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p, out);
      continue;
    }
    const ext = extname(p);
    if (ext !== ".css" && ext !== ".tsx") continue;
    if (inScope(rel)) out.push(rel);
  }
  return out;
}

function allowedFontSize(value: string) {
  const s = value.trim();
  if (s === "0" || s === "inherit") return true;
  if (s === "max(1rem, 16px)") return true;
  if (/^var\(--text-(caption|body|title|headline|display|page)\)$/.test(s)) return true;
  if (/^var\(--cta-font-size\)$/.test(s)) return true;
  if (/^[\d.]+em$/i.test(s)) return true;
  if (/^calc\(var\(--chevron-size/.test(s)) return true;
  return false;
}

function blockHasArtFace(src: string, offset: number) {
  const before = src.slice(Math.max(0, offset - 500), offset);
  const after = src.slice(offset, offset + 280);
  const lastOpen = before.lastIndexOf("{");
  const lastClose = before.lastIndexOf("}");
  const head = lastOpen > lastClose ? before.slice(lastOpen) : "";
  return /font-maytra|CardOverlay|card-overlay|font-card-overlay/i.test(
    head + after,
  );
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const hits: string[] = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  const fontSizeRe = /font-size:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = fontSizeRe.exec(src))) {
    if (blockHasArtFace(src, m.index)) continue;
    if (allowedFontSize(m[1])) continue;
    const line = src.slice(0, m.index).split("\n").length;
    hits.push(`${file}:${line} font-size: ${m[1].trim()}`);
  }
  if (file.endsWith(".tsx")) {
    const arb = /text-\[(\d+(?:\.\d+)?)px\]/g;
    while ((m = arb.exec(src))) {
      const line = src.slice(0, m.index).split("\n").length;
      hits.push(`${file}:${line} ${m[0]}`);
    }
    const prop = /\sfontSize=\{\s*\d+\s*\}/g;
    while ((m = prop.exec(src))) {
      const line = src.slice(0, m.index).split("\n").length;
      hits.push(`${file}:${line} fontSize={N} pixel override`);
    }
  }
}

assert(hits.length === 0, `type scale literals:\n${hits.join("\n")}`);

const tokens = readFileSync("src/index.css", "utf8");
assert(tokens.includes("--text-caption-min"), "caption min token");
assert(tokens.includes("--text-page-min"), "page min token");
assert(tokens.includes("--fluid-min-vw"), "shared fluid viewport");
assert(tokens.includes("tan(atan2("), "fluid 0-1 uses atan2 fallback");

console.log("theme.typography.self-check: ok");
