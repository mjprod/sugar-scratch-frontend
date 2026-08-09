/**
 * ponytail: auth-only check for v8.
 * Run: npx tsx src/v8/flow/auth.self-check.ts
 */
import {
  authFailureMessage,
  createAccountFailureMessage,
  forgotPasswordSuccessMessage,
  isValidAuthPassword,
  supportingCopyForTrigger,
  triggerFromAction,
} from "./auth";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(!isValidAuthPassword("short"), "reject short");
assert(isValidAuthPassword("twelvechars!"), "accept 12+");
assert(
  authFailureMessage() === "Incorrect email or password.",
  "neutral login failure",
);
assert(
  forgotPasswordSuccessMessage().includes("If an account exists for this email"),
  "forgot never reveals existence",
);
assert(
  createAccountFailureMessage() ===
    "Unable to create account. Please try again.",
  "generic create failure",
);
assert(
  supportingCopyForTrigger("buy-pack").includes("purchase"),
  "buy supporting copy",
);
assert(
  triggerFromAction({ type: "like", feedItemId: "x" }) === "like-creator",
  "like trigger",
);

console.log("auth.self-check: ok");
