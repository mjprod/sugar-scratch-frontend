import { clamp } from './math'

export const FLIP_DRAG_THRESHOLD = 8
/** Pull ratio (0–1 from card center) that auto-completes the flip while dragging. */
export const FLIP_AUTO_COMPLETE = 0.82
/** Pull ratio that snaps to a face on release. */
export const FLIP_SNAP_ON_RELEASE = 0.68

export type FlipDragState = {
  pointerId: number
  startX: number
  startPull: number
  baseAngle: number
  towardBack: boolean
  dragging: boolean
}

/** Signed horizontal pull from card center, 0 at center and 1 at either edge. */
export function getFlipPull(clientX: number, rect: DOMRect): number {
  const halfWidth = rect.width / 2
  if (halfWidth <= 0) return 0
  const centerX = rect.left + halfWidth
  return clamp(Math.abs(clientX - centerX) / halfWidth, 0, 1)
}

export function createFlipDragState(
  pointerId: number,
  clientX: number,
  rect: DOMRect,
  baseAngle: number
): FlipDragState {
  return {
    pointerId,
    startX: clientX,
    startPull: getFlipPull(clientX, rect),
    baseAngle,
    towardBack: baseAngle < 90,
    dragging: false,
  }
}

/** Map center-relative pull to a Y-rotation angle (0 = front, 180 = back). */
export function flipAngleFromPull(
  pull: number,
  drag: Pick<FlipDragState, 'startPull' | 'baseAngle' | 'towardBack'>
): number {
  const pullDelta = pull - drag.startPull
  const range = drag.towardBack ? 180 - drag.baseAngle : drag.baseAngle
  const denom =
    pullDelta >= 0
      ? Math.max(1 - drag.startPull, 0.08)
      : Math.max(drag.startPull, 0.08)

  const next = drag.towardBack
    ? drag.baseAngle + (pullDelta / denom) * range
    : drag.baseAngle - (pullDelta / denom) * range

  return clamp(next, 0, 180)
}

export function snapFlipAngle(
  pull: number,
  currentAngle: number,
  drag: Pick<FlipDragState, 'towardBack'>
): number {
  if (pull >= FLIP_SNAP_ON_RELEASE) {
    return drag.towardBack ? 180 : 0
  }
  return currentAngle >= 90 ? 180 : 0
}
