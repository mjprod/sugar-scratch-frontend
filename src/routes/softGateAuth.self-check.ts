/**
 * Soft-gate: guest deep-link opens login; logout on a gated page does not.
 * Run: npx tsx src/routes/softGateAuth.self-check.ts
 */
import { shouldPromptLoginOnSoftGate } from "./softGateAuth.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  !shouldPromptLoginOnSoftGate(false, false, false),
  "wait for session before prompting",
);
assert(
  shouldPromptLoginOnSoftGate(true, false, false),
  "guest deep-link opens login",
);
assert(
  !shouldPromptLoginOnSoftGate(true, true, false),
  "signed-in users pass through",
);
assert(
  !shouldPromptLoginOnSoftGate(true, false, true),
  "logout on a gated page does not reopen login",
);

console.log("softGateAuth.self-check: ok");
