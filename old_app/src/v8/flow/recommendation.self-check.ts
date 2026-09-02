/**
 * ponytail: tiny runnable check for v8 adaptive recommendation helpers.
 * Run: npx tsx src/v8/flow/recommendation.self-check.ts
 */
import {
  isValidAuthPassword,
  authFailureMessage,
  createAccountFailureMessage,
  forgotPasswordSuccessMessage,
  supportingCopyForTrigger,
  triggerFromAction,
} from "./auth";
import {
  MIN_PERSONALIZATION_CARDS,
  RECOMMENDATION_CARDS,
  isHighIntentPending,
} from "./recommendation";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(!isValidAuthPassword("short"), "reject short");
assert(isValidAuthPassword("twelvechars!"), "accept 12+");
assert(MIN_PERSONALIZATION_CARDS >= 6, "configurable card count");
assert(
  RECOMMENDATION_CARDS.length >= MIN_PERSONALIZATION_CARDS,
  "enough cards",
);
assert(
  RECOMMENDATION_CARDS.some(
    (c) => c.name === "Juliana" && c.theme === "Buenos Aires",
  ),
  "juliana card",
);
assert(
  RECOMMENDATION_CARDS.some(
    (c) => c.name === "Emily" && c.theme === "Office Collection",
  ),
  "creator × theme",
);
assert(
  isHighIntentPending({
    type: "buy",
    pack: {
      packId: "p",
      packName: "x",
      price: "3",
      creator: "Emily",
      entry: "purchase",
    },
  }),
  "buy is high intent",
);
assert(
  !isHighIntentPending({ type: "like", feedItemId: "x" }),
  "like is low intent",
);
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

console.log("recommendation.self-check: ok");
