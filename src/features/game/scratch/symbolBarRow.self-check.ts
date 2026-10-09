/**
 * Self-check for the top-row geometry shared by the symbol bar and the game
 * shell's pause button. Mirrors the CSS in features/game/game.css
 * (--game-symbol-slot, .stage-game__pause) and features/game/scratch/styles.css
 * (.symbol-bar:not(.is-phase-center):not(.is-phase-showcase)) — if those
 * numbers drift apart, this fails.
 *
 * Run: npx tsx src/features/game/scratch/symbolBarRow.self-check.ts
 */
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const BUTTON = 40;
const BUTTON_LEFT = 12;
const CLEARANCE = 8;
const BAR_RIGHT_INSET = 12;
const BAR_LEFT_INSET = BUTTON_LEFT + BUTTON + CLEARANCE;

const SLOT_COUNT = 6;
const GAP = 5;
const PAD = 9;
const BORDER = 1;
const MAX_SLOT = 44;
const ICON = 28;

/** Row top for both elements: max(12px, safe-area), unnotched. */
const ROW_TOP = 12;

/** The `117px` literal baked into --game-symbol-slot. */
const FIXED_COST =
  BAR_LEFT_INSET +
  BAR_RIGHT_INSET +
  (SLOT_COUNT - 1) * GAP +
  2 * PAD +
  2 * BORDER;

const slotAt = (stageW: number) =>
  Math.min(MAX_SLOT, (stageW - FIXED_COST) / SLOT_COUNT);

const barWidth = (slot: number) =>
  SLOT_COUNT * slot + (SLOT_COUNT - 1) * GAP + 2 * PAD + 2 * BORDER;

const barHeight = (slot: number) => slot + 2 * PAD + 2 * BORDER;

/** left/right insets + margin-inline:auto centre the bar in its band, and let
 *  it overflow symmetrically when the slots (flex-shrink:0) can't fit. */
const barLeft = (stageW: number, slot: number) =>
  BAR_LEFT_INSET +
  (stageW - BAR_LEFT_INSET - BAR_RIGHT_INSET - barWidth(slot)) / 2;

const buttonTop = (slot: number) => ROW_TOP + (barHeight(slot) - BUTTON) / 2;

assert(
  FIXED_COST === 117,
  `fixed row cost is ${FIXED_COST}, but the CSS hardcodes 117 — update both`,
);

// Stage widths from a cramped desktop frame up past the design width.
for (let stageW = 300; stageW <= 600; stageW += 1) {
  const slot = slotAt(stageW);

  assert(
    barLeft(stageW, slot) >= BUTTON_LEFT + BUTTON,
    `bar overlaps the pause button at stage ${stageW} (bar left ${barLeft(stageW, slot)})`,
  );

  assert(
    Math.abs(
      buttonTop(slot) + BUTTON / 2 - (ROW_TOP + barHeight(slot) / 2),
    ) < 1e-9,
    `centre lines diverge at stage ${stageW}`,
  );

  assert(slot <= MAX_SLOT, `slot grew past ${MAX_SLOT} at stage ${stageW}`);
  assert(slot >= ICON + 2, `icon clips at stage ${stageW} (slot ${slot})`);
}

// 390px is the design width: symbols must stay full size there.
assert(slotAt(390) === MAX_SLOT, "slot should be 44px at the 390px design width");

// 381px is where the full-size bar exactly fills its band.
assert(slotAt(381) === MAX_SLOT, "slot should still be 44px at 381px");
assert(slotAt(380) < MAX_SLOT, "slot should start shrinking below 381px");

// The bug being fixed: the old 44px/gap-8/pad-14 bar overlapped at 390px.
const oldBarWidth = SLOT_COUNT * 44 + (SLOT_COUNT - 1) * 8 + 2 * 14 + 2 * BORDER;
assert(
  (390 - oldBarWidth) / 2 < BUTTON_LEFT + BUTTON,
  "regression guard is wrong: the old stage-centred bar did clear the button",
);

console.log("symbolBarRow.self-check: ok");
