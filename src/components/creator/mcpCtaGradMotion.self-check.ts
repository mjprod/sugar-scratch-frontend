/**
 * Run: npx tsx src/components/creator/mcpCtaGradMotion.self-check.ts
 */
import { mcpCtaGradAngleFromMotion } from "./mcpCtaGradMotion.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const rest = mcpCtaGradAngleFromMotion(0, 55);
assert(Math.abs(rest - 45) < 0.01, `rest pose should be 45deg, got ${rest}`);

const left = mcpCtaGradAngleFromMotion(-42, 55);
assert(left > rest, `phone-left should raise angle (${left} vs ${rest})`);

const right = mcpCtaGradAngleFromMotion(42, 55);
assert(right < rest, `phone-right should lower angle (${right} vs ${rest})`);

const clamped = mcpCtaGradAngleFromMotion(200, 55);
assert(
  Math.abs(clamped - mcpCtaGradAngleFromMotion(42, 55)) < 0.01,
  "gamma should clamp at ±42",
);

console.log("mcpCtaGradMotion.self-check: ok");
