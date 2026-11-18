/**
 * Locked packet-open motion — hinged seal + opposite pack spin.
 * Tuned on /card-open-test; production always ships these baked defaults.
 */

/** Seal hinge corner after the horizontal flip. */
export const PACK_OPEN_HINGE = "bottom-right" as const;

/**
 * Pack yaw after the seal flip (opposite the pre-flip bottom-left tear):
 * anticipation winds +, main spin path −, settle overshoot −.
 */
export const PACK_OPEN_SPIN_YAW = {
  anticipationSign: 1,
  spinPathSign: -1,
  overshootSign: -1,
} as const;

/** Tear end key (tear-6) — lid fully peeled / faded. */
export const PACK_OPEN_TEAR_END = {
  id: "tear-6",
  rotX: 302,
  rotY: -3,
  rotZ: 11,
  opacity: 0,
} as const;
