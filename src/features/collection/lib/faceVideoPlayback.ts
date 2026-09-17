/**
 * Poster-first HoloCard face clips: when the selected <video> should start.
 *
 * CollectionExperience preloads the hero trailer into a detached element, so
 * Safari often attaches the cached src on a later mount without re-firing
 * loadeddata/canplay. Decode polling must still call play() — event-only
 * playback misses that path.
 */

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

/** NETWORK_IDLE + no frame yet: nudge load() so a cached src attaches. */
export function shouldNudgeCachedSrcLoad(args: {
  readyState: number
  networkState: number
  networkIdle: number
}): boolean {
  return (
    args.readyState < FACE_VIDEO_FRAME_READY_STATE &&
    args.networkState === args.networkIdle
  )
}
