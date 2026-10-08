#!/usr/bin/env node
/**
 * One-off: re-encode oversized PNGs in public/ as WebP at display size.
 * Needs `cwebp` on PATH (brew install webp). Writes `<name>.webp` next to the
 * source; pass --remove-src to delete the PNG afterwards.
 *
 *   node scripts/optimize-images.mjs [--remove-src]
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const PUBLIC = "public";
const REMOVE_SRC = process.argv.includes("--remove-src");

/** width = max output width in px (0 keeps source size). */
const TARGETS = [
  { src: "images/home-v2/how-win.png", width: 0, quality: 80 },
  { src: "img/placeholder.png", width: 600, quality: 75 },
  { src: "img/figma-my-collection/1d9af28cb93cd6d47151fef2a48c01962ccfd627.png", width: 1170, quality: 78 },
  { src: "img/figma-my-collection/86d4f39478b36d507194017d10f86c3f93bb849f.png", width: 1170, quality: 78 },
];

const kb = (file) => (statSync(file).size / 1024).toFixed(0);

for (const { src, width, quality } of TARGETS) {
  const input = path.join(PUBLIC, src);
  if (!existsSync(input)) {
    console.warn(`[optimize-images] skip missing ${input}`);
    continue;
  }
  const output = input.replace(/\.png$/i, ".webp");
  const args = ["-quiet", "-q", String(quality), "-alpha_q", "90", "-m", "6"];
  if (width > 0) args.push("-resize", String(width), "0");
  args.push(input, "-o", output);
  execFileSync("cwebp", args, { stdio: "inherit" });
  console.log(`[optimize-images] ${input} ${kb(input)} KB -> ${output} ${kb(output)} KB`);
  if (REMOVE_SRC) unlinkSync(input);
}
