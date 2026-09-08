/**
 * ponytail: auth-only check for v8.
 * Run: npx tsx src/v8/flow/auth.self-check.ts
 */
import { ApiError } from "../lib/api";
import {
  authFailureMessage,
  createAccountFailureMessage,
  duplicateEmailMessage,
  forgotPasswordSuccessMessage,
  isDuplicateEmailRegisterError,
  isValidAuthPassword,
  supportingCopyForTrigger,
  TEMP_VERIFICATION_CODE,
  triggerFromAction,
  resendCooldownLabel,
  verificationCodeFailureMessage,
  verificationSendFailureMessage,
} from "./auth";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(!isValidAuthPassword("short"), "reject short");
assert(!isValidAuthPassword("sevench"), "reject 7");
assert(isValidAuthPassword("eightchr"), "accept 8+");
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
  duplicateEmailMessage() === "An account with this email already exists.",
  "duplicate email copy",
);
assert(
  verificationCodeFailureMessage().includes("invalid or has expired"),
  "verify code failure copy",
);
assert(
  TEMP_VERIFICATION_CODE === "000",
  "temp verify code is 000",
);
assert(resendCooldownLabel(0) === "Resend", "idle resend label");
assert(resendCooldownLabel(45) === "Resend in 45s", "cooldown resend label");
assert(resendCooldownLabel(1) === "Resend in 1s", "cooldown 1s label");
assert(
  verificationSendFailureMessage().includes("technical issue"),
  "verify send failure copy",
);
assert(
  isDuplicateEmailRegisterError(
    new ApiError(409, "Conflict", { detail: "Email already registered" }),
  ),
  "409 is duplicate email",
);
assert(
  isDuplicateEmailRegisterError(
    new ApiError(400, "Bad Request", { detail: "Email already exists" }),
  ),
  "400 already exists is duplicate",
);
assert(
  !isDuplicateEmailRegisterError(new ApiError(500, "Server error")),
  "500 is not duplicate email",
);
assert(
  supportingCopyForTrigger("buy-pack").includes("purchase"),
  "buy supporting copy",
);
assert(
  triggerFromAction({ type: "like", feedItemId: "x" }) === "like-creator",
  "like trigger",
);
assert(
  triggerFromAction({ type: "follow", creatorId: "c1" }) === "follow-creator",
  "follow trigger",
);
assert(
  supportingCopyForTrigger("follow-creator").includes("follow"),
  "follow supporting copy",
);

console.log("auth.self-check: ok");
