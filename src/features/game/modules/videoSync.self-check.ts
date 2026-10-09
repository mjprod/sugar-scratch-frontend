/**
 * Offline invariants for dual-video loop sync (Phase 4).
 * Run: npx tsx src/features/game/modules/videoSync.self-check.ts
 */
import {
  createVideoSyncState,
  decideVideoSync,
  HARD_SEEK_DRIFT_S,
  isLoopEdgeDesync,
  SEEK_COOLDOWN_MS,
  SOFT_SEEK_DRIFT_S,
  shortestMediaDrift,
} from "./videoSync";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const DUR = 18.8;

// Loop wrap: bottom at ~0, FG still near end — raw delta is huge; shortest is small.
{
  const raw = 0.05 - 18.7;
  assert(Math.abs(raw) > HARD_SEEK_DRIFT_S, "raw wrap looks like hard discontinuity");
  const wrapped = shortestMediaDrift(0.05, 18.7, DUR);
  assert(
    Math.abs(wrapped) < HARD_SEEK_DRIFT_S,
    "wrapped wrap must not hard-seek",
  );
  assert(
    isLoopEdgeDesync(0.05, 18.7, DUR),
    "wrap race detected as loop-edge desync",
  );
}

assert(
  Math.abs(shortestMediaDrift(5, 5.05, DUR) - -0.05) < 1e-9,
  "mid-clip drift unchanged",
);
assert(!isLoopEdgeDesync(5, 5.2, DUR), "mid-clip is not loop-edge");

assert(SOFT_SEEK_DRIFT_S >= 2 / 30, "soft band tolerates ≥2 frames @ 30fps");

{
  const state = createVideoSyncState();
  assert(
    decideVideoSync({
      drift: shortestMediaDrift(0.05, 18.7, DUR),
      now: 1000,
      state,
      desiredTime: 0.05,
      actualTime: 18.7,
      duration: DUR,
    }).action === "none",
    "loop-edge desync waits for natural wrap",
  );
  assert(
    decideVideoSync({
      drift: shortestMediaDrift(0.05, 18.7, DUR),
      now: 1500,
      state,
      desiredTime: 0.05,
      actualTime: 18.7,
      duration: DUR,
    }).action === "none",
    "loop-edge still suppressed after confirm window",
  );
}

{
  const state = createVideoSyncState();
  assert(
    decideVideoSync({ drift: 0.04, now: 1000, state }).action === "none",
    "sub-frame drift ignored",
  );

  assert(
    decideVideoSync({ drift: 0.12, now: 2000, state }).action === "none",
    "soft starts confirm window",
  );
  assert(
    decideVideoSync({ drift: 0.12, now: 2100, state }).action === "none",
    "soft still confirming",
  );
  const soft = decideVideoSync({ drift: 0.12, now: 2250, state });
  assert(soft.action === "seek" && soft.reason === "soft", "soft seeks after confirm");

  const blocked = decideVideoSync({ drift: 1.0, now: 2300, state });
  assert(blocked.action === "none", "cooldown blocks hard seek storm");

  const after = decideVideoSync({
    drift: 1.0,
    now: 2300 + SEEK_COOLDOWN_MS,
    state,
  });
  assert(after.action === "seek" && after.reason === "hard", "hard seek after cooldown");
}

{
  const state = createVideoSyncState();
  assert(
    decideVideoSync({
      drift: 0.12,
      now: 2000,
      state,
      isScratching: true,
    }).action === "none",
    "soft suppressed while scratching",
  );
  assert(
    decideVideoSync({
      drift: 0.12,
      now: 3000,
      state,
      isScratching: true,
    }).action === "none",
    "soft still suppressed mid-stroke",
  );
  const softAfter = decideVideoSync({
    drift: 0.12,
    now: 4000,
    state,
    isScratching: false,
  });
  assert(softAfter.action === "none", "soft confirm starts after stroke");
  const softFire = decideVideoSync({
    drift: 0.12,
    now: 4000 + 250,
    state,
    isScratching: false,
  });
  assert(
    softFire.action === "seek" && softFire.reason === "soft",
    "soft seeks after stroke once confirmed",
  );
  const hardWhileScratch = decideVideoSync({
    drift: 1.0,
    now: 4000 + SEEK_COOLDOWN_MS + 100,
    state: createVideoSyncState(),
    isScratching: true,
  });
  assert(
    hardWhileScratch.action === "seek" && hardWhileScratch.reason === "hard",
    "hard seek still allowed while scratching",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      SOFT_SEEK_DRIFT_S,
      HARD_SEEK_DRIFT_S,
      SEEK_COOLDOWN_MS,
      policy:
        "wrapped drift + loop-edge wait + cooldown; soft suppressed while scratching",
    },
    null,
    2,
  ),
);
