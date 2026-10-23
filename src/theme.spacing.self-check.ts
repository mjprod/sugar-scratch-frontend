/**
 * Guardrail: spacing tokens exist, and page shells use px-page / gap-section
 * / gap-stack instead of one-off canvas gutters.
 * Run: npx tsx src/theme.spacing.self-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const tokens = readFileSync("src/index.css", "utf8");

function decl(name: string) {
  const m = tokens.match(new RegExp(`${name}:\\s*([^;]+);`));
  assert(m, `missing token ${name}`);
  return m[1].trim();
}

function isRemOrSpaceVar(value: string) {
  return /^[\d.]+rem$/.test(value) || /^var\(--space-[\w-]+\)$/.test(value);
}

const SCALE = [
  "--space-px",
  "--space-0-5",
  "--space-1",
  "--space-1-5",
  "--space-2",
  "--space-2-5",
  "--space-3",
  "--space-3-5",
  "--space-4",
  "--space-4-5",
  "--space-5",
  "--space-6",
  "--space-7",
  "--space-8",
  "--space-10",
  "--space-12",
  "--space-16",
];
assert(decl("--space-px") === "1px", "--space-px must stay 1px");
for (const name of SCALE.slice(1)) {
  const value = decl(name);
  assert(isRemOrSpaceVar(value), `${name} must be rem, got ${value}`);
}

const SEMANTIC = ["--pad-page", "--pad-card", "--gap", "--gap-section", "--gap-stack"];
for (const name of SEMANTIC) {
  const value = decl(name);
  assert(isRemOrSpaceVar(value), `${name} must be rem or var(--space-*), got ${value}`);
}

assert(tokens.includes("--spacing-page:"), "Tailwind --spacing-page");
assert(tokens.includes("--spacing-card:"), "Tailwind --spacing-card");
assert(tokens.includes("--spacing-section:"), "Tailwind --spacing-section");
assert(tokens.includes("--spacing-stack:"), "Tailwind --spacing-stack");

assert(!/--pad-1:/.test(tokens), "numbered --pad-* aliases must stay deleted");
assert(!/--margin-4:/.test(tokens), "numbered --margin-* aliases must stay deleted");
assert(!tokens.includes("--margin-section"), "use --gap-section, not --margin-section");
assert(!tokens.includes("--margin-stack"), "use --gap-stack, not --margin-stack");

const PAGE_SHELLS = [
  "src/components/home/HomeVersion2Screen.tsx",
  "src/components/home/RankScreen.tsx",
  "src/components/browse/BrowseScreen.tsx",
  "src/components/search/SearchScreen.tsx",
  "src/components/purchase/PurchaseFlow.tsx",
  "src/theme.css",
  "src/components/store/GetDiamondsScreen.css",
];

const FORBIDDEN = [
  /px-5 lg:px-8/,
  /px-4 sm:px-6 lg:px-8/,
  /gap-\[15px\]/,
];

const hits: string[] = [];

for (const file of PAGE_SHELLS) {
  const src = readFileSync(file, "utf8");
  for (const re of FORBIDDEN) {
    const m = src.match(re);
    if (m) hits.push(`${file}: ${m[0]}`);
  }
  const inner = /(?:home-page-inner|search-page-inner)[^"'`]*(?:px-4|px-5|px-6|px-8)(?!-page)/g;
  let match: RegExpExecArray | null;
  while ((match = inner.exec(src))) {
    hits.push(`${file}: canvas gutter ${match[0].slice(0, 80)}`);
  }
}

const pageContainer = readFileSync("src/theme.css", "utf8");
assert(
  /body\[data-theme="v8"\] \.page-container[\s\S]*?padding-inline:\s*var\(--app-gutter,\s*var\(--pad-page\)\)/.test(
    pageContainer,
  ),
  ".page-container must use --pad-page",
);

assert(hits.length === 0, `page-shell gutters:\n${hits.join("\n")}`);

const PX_TO_TOKEN: Record<number, boolean> = {
  1: true,
  2: true,
  4: true,
  6: true,
  8: true,
  10: true,
  12: true,
  14: true,
  16: true,
  18: true,
  20: true,
  24: true,
  28: true,
  32: true,
  40: true,
  48: true,
  64: true,
};

const PROP =
  /(?<![\w-])((?:padding|margin)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?|gap|row-gap|column-gap)\s*:\s*/gi;
const LENGTH = /-?[\d.]+(?:px|rem)\b/gi;
const CSS_SKIP = ["src/features/game/scratch/", "src/pages/lp-build/"];

function maskFuncs(src: string, names: string[]) {
  const slots: string[] = [];
  let out = "";
  let i = 0;
  while (i < src.length) {
    let name = "";
    for (const n of names) {
      if (src.startsWith(`${n}(`, i)) {
        name = n;
        break;
      }
    }
    if (!name) {
      out += src[i];
      i++;
      continue;
    }
    let depth = 0;
    let j = i + name.length;
    for (; j < src.length; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    slots.push(src.slice(i, j));
    out += `__F${slots.length - 1}__`;
    i = j;
  }
  return out;
}

function lengthKind(raw: string): "zero" | "on" | "off" {
  const m = raw.match(/^(-)?([\d.]+)(px|rem)$/i);
  if (!m) return "off";
  const n = Number(m[2]);
  if (!Number.isFinite(n)) return "off";
  const px = m[3].toLowerCase() === "rem" ? n * 16 : n;
  if (px === 0) return "zero";
  return PX_TO_TOKEN[px] ? "on" : "off";
}

function declHasOnScaleLiteral(value: string) {
  const masked = maskFuncs(value, ["env", "var"]);
  const lengths = masked.match(LENGTH) ?? [];
  if (lengths.length === 0) return false;
  if (lengths.some((raw) => lengthKind(raw) === "off")) return false;
  return lengths.some((raw) => lengthKind(raw) === "on");
}

function walkCss(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    const rel = p.replace(/\\/g, "/");
    const st = statSync(p);
    if (st.isDirectory()) {
      walkCss(p, out);
      continue;
    }
    if (extname(p) !== ".css") continue;
    if (CSS_SKIP.some((s) => rel === s || rel.startsWith(s))) continue;
    out.push(rel);
  }
  return out;
}

const cssHits: string[] = [];
for (const file of walkCss("src")) {
  const src = readFileSync(file, "utf8");
  PROP.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROP.exec(src))) {
    const valueStart = m.index + m[0].length;
    let depth = 0;
    let i = valueStart;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth = Math.max(0, depth - 1);
      else if ((c === ";" || c === "}") && depth === 0) break;
    }
    const value = src.slice(valueStart, i);
    if (declHasOnScaleLiteral(value)) {
      const line = src.slice(0, m.index).split("\n").length;
      cssHits.push(`${file}:${line} ${m[1]}: ${value.trim().slice(0, 80)}`);
    }
    PROP.lastIndex = i;
  }
}

assert(cssHits.length === 0, `on-scale spacing literals:\n${cssHits.join("\n")}`);

console.log("theme.spacing.self-check: ok");
