/**
 * Chest-follow while scratching (Phase 8).
 * Continuous pan forces GL presents via camMoved; freeze the camera while the
 * finger is down so scratch + video upload aren't fighting a live pan.
 */
export function shouldUpdateChestFollow(opts: {
  isScratching: boolean;
}): boolean {
  return !opts.isScratching;
}
