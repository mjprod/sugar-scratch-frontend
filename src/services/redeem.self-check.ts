/**
 * Redeem self-check.
 * Run: npx tsx src/services/redeem.self-check.ts
 */
import { REDEEM_ERROR_COPY } from "./redeem.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(REDEEM_ERROR_COPY.invalid_code.includes("isn't valid"), "invalid copy");
assert(REDEEM_ERROR_COPY.expired.includes("expired"), "expired copy");
assert(REDEEM_ERROR_COPY.already_redeemed.includes("already"), "already copy");
assert(REDEEM_ERROR_COPY.unavailable.includes("no longer"), "unavailable copy");

console.log("v8 redeem self-check passed");
