/**
 * Lab-only shared state for /game-ui frame-start tuning.
 * Avoids CSS custom-property unit quirks and keeps the progress path mounted.
 */

export type FrameStartLabState = {
  /** 0 = top-left, clockwise, may exceed 1. */
  start: number;
  /** While > 0, force a preview arc of this length (0..1). 0 = live game progress. */
  previewProgress: number;
  /** Panel open — keep frame mounted when previewing. */
  previewOpen: boolean;
};

const DEFAULT: FrameStartLabState = {
  start: 0.178,
  previewProgress: 0.35,
  previewOpen: false,
};

let state: FrameStartLabState = { ...DEFAULT };
const listeners = new Set<() => void>();

export function getFrameStartLabState() {
  return state;
}

export function setFrameStartLabState(patch: Partial<FrameStartLabState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeFrameStartLab(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the START panel wants the progress frame forced on. */
export function isFrameStartPreviewActive() {
  return state.previewOpen && state.previewProgress > 0;
}
