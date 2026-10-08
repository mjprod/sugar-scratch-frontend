/**
 * Deferred Lottie gate + wasm version self-check.
 * Run: npx tsx src/lib/lottie/deferredLottie.self-check.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLottieGate, type LottieGateEnv } from "./deferredLottieGate.ts";
import { DOTLOTTIE_WASM_PATH, DOTLOTTIE_WEB_VERSION } from "./wasmPath.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function fakeEnv() {
  const pending = { loaded: null as null | (() => void), idle: null as null | (() => void), interact: null as null | (() => void) };
  const cleaned = { loaded: false, idle: false, interact: false };
  const env: LottieGateEnv = {
    whenLoaded(cb) {
      pending.loaded = cb;
      return () => void (cleaned.loaded = true);
    },
    whenIdle(cb) {
      pending.idle = cb;
      return () => void (cleaned.idle = true);
    },
    onFirstInteraction(cb) {
      pending.interact = cb;
      return () => void (cleaned.interact = true);
    },
  };
  return { env, pending, cleaned };
}

// Starts closed; idle is only scheduled after load.
{
  const { env, pending } = fakeEnv();
  const gate = createLottieGate(env);
  assert(!gate.isOpen(), "gate starts closed");
  assert(pending.idle === null, "idle not scheduled before load");
  pending.loaded?.();
  assert(!gate.isOpen(), "load alone does not open the gate");
  assert(pending.idle !== null, "idle scheduled after load");
  pending.idle?.();
  assert(gate.isOpen(), "load + idle opens the gate");
}

// First interaction opens immediately and tears down other listeners.
{
  const { env, pending, cleaned } = fakeEnv();
  const gate = createLottieGate(env);
  let notified = 0;
  gate.subscribe(() => void (notified += 1));
  pending.interact?.();
  assert(gate.isOpen(), "interaction opens the gate");
  assert(notified === 1, "subscribers notified once");
  assert(cleaned.interact && cleaned.loaded, "listeners cleaned up on open");
  pending.loaded?.();
  assert(pending.idle === null, "no idle scheduled after the gate is open");
  gate.open();
  assert(notified === 1, "open is one-shot");
}

// Unsubscribe stops notifications.
{
  const { env } = fakeEnv();
  const gate = createLottieGate(env);
  let notified = 0;
  const off = gate.subscribe(() => void (notified += 1));
  off();
  gate.open();
  assert(notified === 0, "unsubscribed listener is not called");
}

// Wasm file name must track the pinned and installed dotlottie-web version.
{
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
  const pinned = pkg.dependencies["@lottiefiles/dotlottie-web"];
  assert(
    pinned === DOTLOTTIE_WEB_VERSION,
    `wasmPath DOTLOTTIE_WEB_VERSION ${DOTLOTTIE_WEB_VERSION} must equal package.json pin ${pinned}`,
  );
  const installed = JSON.parse(
    readFileSync(`${root}node_modules/@lottiefiles/dotlottie-web/package.json`, "utf8"),
  ).version;
  assert(
    installed === DOTLOTTIE_WEB_VERSION,
    `installed dotlottie-web ${installed} must equal ${DOTLOTTIE_WEB_VERSION}`,
  );
  assert(
    DOTLOTTIE_WASM_PATH === `/wasm/dotlottie-player.${DOTLOTTIE_WEB_VERSION}.wasm`,
    "wasm path is versioned",
  );
}

console.log("deferredLottie self-check OK");
