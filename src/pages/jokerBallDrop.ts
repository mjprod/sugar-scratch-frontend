/** Intro drop: fall from above, bounce, settle on the ground plane. */

/** High enough that the ball enters from above the tall (page-top) canvas. */
export const DROP_START_Y = 5.6;
export const DROP_GRAVITY = -32;
export const DROP_BOUNCE = 0.48;
/** Stop bouncing once rebound speed is below this. */
export const DROP_REST_SPEED = 0.55;

/**
 * One physics step for the ball centre Y.
 * Collision is a hard floor at `restY` with energy loss on bounce.
 */
export function stepBallDrop(
  y: number,
  v: number,
  dt: number,
  restY: number,
): { y: number; v: number; settled: boolean } {
  const t = Math.max(0, Math.min(dt, 1 / 20));
  let nextV = v + DROP_GRAVITY * t;
  let nextY = y + nextV * t;
  let settled = false;

  if (nextY <= restY) {
    nextY = restY;
    nextV = -nextV * DROP_BOUNCE;
    if (Math.abs(nextV) < DROP_REST_SPEED) {
      nextV = 0;
      settled = true;
    }
  }

  return { y: nextY, v: nextV, settled };
}

/** 0 at apex / start, 1 when resting on the plane. */
export function dropLandStrength(
  y: number,
  restY: number,
  startY: number = DROP_START_Y,
): number {
  const span = Math.max(0.001, startY - restY);
  return Math.max(0, Math.min(1, 1 - (y - restY) / span));
}
