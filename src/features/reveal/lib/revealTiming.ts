export type RevealPhase = "idle" | "revealing" | "complete";

/** Pack rise duration (approx start settle). Pack-internal timing lives in PackMesh. */
export const PACK_ENTER_MS = 585;

/**
 * Independent fan start delay from Buy/Preview press.
 * Not coupled to pack shake/spin constants — change this freely.
 *
 * Tuned to land near the pack shake-out (drop now runs during the spin).
 * Pack and fan no longer share playback state.
 * Shifted earlier with the 15% faster duck so fan still hits the same
 * relative point in the tuck (was 1380 with 810ms duck).
 */
export const FAN_START_DELAY_MS = 1287;

/** Delay after fan trigger before the first card pops. */
export const CARDS_FAN_START_DELAY_MS = 0;

/** Stagger between each card in the fan. */
export const CARD_STAGGER_MS = 25;

/** Spring duration feel for each card. */
export const CARD_FAN_MS = 450;

/**
 * How early the Play CTA can appear before the fan settle fully rests.
 * Keeps the button feeling snappy without waiting for the last spring tick.
 */
export const PLAY_CTA_EARLY_MS = 630;

/**
 * Shared with pack post-shake tuck so the fan group eases down in sync
 * when the foil pack moves up/back behind the cards.
 * Duck-back ~15% faster (was 810 / 162).
 */
export const POST_SHAKE_ANTICIPATION_MS = 138;
export const POST_SHAKE_MOVE_MS = 689;
/**
 * Fan-group sync drop (can differ from pack move duration for a slower settle).
 * Anticipation is longer/stronger than the pack's so the hand reads a clear wind-up.
 * Kept in proportion with the faster duck-back.
 */
export const FAN_GROUP_SYNC_ANTICIPATION_MS = 138;
export const FAN_GROUP_SYNC_ANTICIPATION_Y = -18;
export const FAN_GROUP_SYNC_MOVE_MS = 750;
/** How far the whole fan group settles downward (px) during pack tuck. */
export const FAN_GROUP_SYNC_DROP_PX = 92;

/** Visual card size in the fan (matches holo 251×475 aspect). */
export const FAN_CARD_WIDTH = 118;
export const FAN_CARD_HEIGHT = Math.round(FAN_CARD_WIDTH / 0.528421);

// Fan spacing lives in fanLayout.ts (debug-tunable).
