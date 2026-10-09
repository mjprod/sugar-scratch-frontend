/**
 * Poster-first HoloCard face clips: when the selected <video> should start.
 *
 * CollectionExperience preloads the hero trailer into a detached element, so
 * Safari often attaches the cached src on a later mount without re-firing
 * loadeddata/canplay. Decode polling must still call play() — event-only
 * playback misses that path.
 */

/** HAVE_NOTHING — src has not produced metadata yet. */
export const FACE_VIDEO_HAVE_NOTHING = 0

/** HAVE_METADATA — duration/dimensions known; no decoded frame yet. */
export const FACE_VIDEO_HAVE_METADATA = 1

/** HAVE_CURRENT_DATA — a decoded frame is available. */
export const FACE_VIDEO_FRAME_READY_STATE = 2

export function shouldPlayFromDecodePoll(args: {
  playFrontVideo: boolean
  scrubbing: boolean
  readyState: number
  paused: boolean
}): boolean {
  return (
    args.playFrontVideo &&
    !args.scrubbing &&
    args.readyState >= FACE_VIDEO_FRAME_READY_STATE &&
    args.paused
  )
}

/**
 * NETWORK_IDLE + HAVE_NOTHING: nudge load() so a cached/preloaded src attaches.
 *
 * Do not nudge once HAVE_METADATA is reached — Safari often goes idle there
 * before the first frame, and load() would wipe that progress (poster freeze).
 * Do not nudge while scrubbing — autoPlay + load() can restart mid-gesture.
 */
export function shouldNudgeCachedSrcLoad(args: {
  readyState: number
  networkState: number
  networkIdle: number
  scrubbing?: boolean
}): boolean {
  if (args.scrubbing) return false
  return (
    args.readyState === FACE_VIDEO_HAVE_NOTHING &&
    args.networkState === args.networkIdle
  )
}
