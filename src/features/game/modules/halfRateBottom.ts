/**
 * Session-wide bottom-video upload policy (Phase 3 perf).
 * FG stays full rate for garment glue; bottom underlay can skip every other frame.
 * Once FG is hidden (claimed / fully revealed), bottom is the only layer — full rate.
 */
export function shouldHalfRateBottomUploads(hideForeground: boolean): boolean {
  return !hideForeground;
}
