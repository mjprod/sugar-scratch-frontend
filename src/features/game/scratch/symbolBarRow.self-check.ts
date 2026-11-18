/**
 * Self-check for the top-row geometry shared by the docked symbol bar and
 * the pause / diamond buttons. Mirrors features/game/game.css
 * (--game-symbol-slot, --game-hud-edge, --game-hud-btn, --game-dock-clear)
 * and features/game/scratch/styles.css (.top-symbol-bar.is-phase-docked).
 *
 * Run: npx tsx src/features/game/scratch/symbolBarRow.self-check.ts
 */
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const BUTTON = 48;
const FRAME_INSET_PHONE = 6;
const FRAME_INSET_DESKTOP = 4;
const PAST_GOLD = 18;
const HUD_EDGE_PHONE = FRAME_INSET_PHONE + PAST_GOLD;
const HUD_EDGE_DESKTOP = FRAME_INSET_DESKTOP + PAST_GOLD;
const DOCK_CLEAR = 4;
const SLOT_COUNT = 6;
const GAP = 3;
const PAD = 8;
const MAX_SLOT = 40;
const MIN_SLOT = 24;

const reserved = (hudEdge: number) =>
  2 * hudEdge + 2 * BUTTON + 2 * DOCK_CLEAR + (SLOT_COUNT - 1) * GAP + 2 * PAD;

const slotAt = (stageW: number, hudEdge: number) =>
  Math.min(MAX_SLOT, (stageW - reserved(hudEdge)) / SLOT_COUNT);

const barWidth = (slot: number) =>
  SLOT_COUNT * slot + (SLOT_COUNT - 1) * GAP + 2 * PAD;

const barLeft = (stageW: number, slot: number) => (stageW - barWidth(slot)) / 2;

function assertClearsButtons(stageW: number, hudEdge: number, label: string) {
  const slot = slotAt(stageW, hudEdge);
  const left = barLeft(stageW, slot);
  const right = left + barWidth(slot);
  const pauseRight = hudEdge + BUTTON;
  const diamondLeft = stageW - hudEdge - BUTTON;

  assert(
    slot >= MIN_SLOT,
    `${label}: slot ${slot} is smaller than ${MIN_SLOT}px at ${stageW}`,
  );
  assert(
    left + 1e-6 >= pauseRight + DOCK_CLEAR,
    `${label}: dock overlaps pause at ${stageW} (bar left ${left}, pause right ${pauseRight})`,
  );
  assert(
    right - 1e-6 <= diamondLeft - DOCK_CLEAR,
    `${label}: dock overlaps diamond at ${stageW} (bar right ${right}, diamond left ${diamondLeft})`,
  );
}

assert(reserved(HUD_EDGE_PHONE) === 183, `phone reserved is ${reserved(HUD_EDGE_PHONE)}, expected 183`);
assert(reserved(HUD_EDGE_DESKTOP) === 179, `desktop reserved is ${reserved(HUD_EDGE_DESKTOP)}, expected 179`);

// Phones: iPhone SE 375, 16e 390, 17 402, S25 Ultra 412, plus cramped 360.
for (const w of [360, 375, 390, 402, 412, 430]) {
  assertClearsButtons(w, HUD_EDGE_PHONE, `phone ${w}`);
}

// Desktop phone-frame shells (701px+ layout, stage ≤ 430).
for (const w of [374, 398, 430]) {
  assertClearsButtons(w, HUD_EDGE_DESKTOP, `desktop ${w}`);
}

// With a tighter HUD edge, 430 desktop keeps full slots; 390 phones still shrink.
assert(slotAt(390, HUD_EDGE_PHONE) < MAX_SLOT, "390px phone should shrink slots so the dock clears pause/diamond");
assert(slotAt(430, HUD_EDGE_DESKTOP) === MAX_SLOT, "430px desktop shell should keep 40px slots");

console.log("symbolBarRow.self-check: ok");
