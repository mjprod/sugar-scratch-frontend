/**
 * Selected face-clip playback after poster-first mount.
 * Run: npx tsx src/features/collection/lib/faceVideoPlayback.self-check.ts
 */
import {
  FACE_VIDEO_FRAME_READY_STATE,
  shouldNudgeCachedSrcLoad,
  shouldPlayFromDecodePoll,
} from "./faceVideoPlayback";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const NETWORK_IDLE = 1;
const NETWORK_LOADING = 2;

assert(
  shouldPlayFromDecodePoll({
    playFrontVideo: true,
    scrubbing: false,
    readyState: FACE_VIDEO_FRAME_READY_STATE,
    paused: true,
  }),
  "selected decoded clip must play even when loadeddata never re-fires",
);

assert(
  !shouldPlayFromDecodePoll({
    playFrontVideo: true,
    scrubbing: false,
    readyState: FACE_VIDEO_FRAME_READY_STATE,
    paused: false,
  }),
  "already-playing clip must not be restarted every poll",
);

assert(
  !shouldPlayFromDecodePoll({
    playFrontVideo: true,
    scrubbing: true,
    readyState: FACE_VIDEO_FRAME_READY_STATE,
    paused: true,
  }),
  "scrubbing must keep the selected clip paused",
);

assert(
  !shouldPlayFromDecodePoll({
    playFrontVideo: false,
    scrubbing: false,
    readyState: FACE_VIDEO_FRAME_READY_STATE,
    paused: true,
  }),
  "browse / unselected cards stay on the poster",
);

assert(
  !shouldPlayFromDecodePoll({
    playFrontVideo: true,
    scrubbing: false,
    readyState: 1,
    paused: true,
  }),
  "do not play before a decoded frame exists",
);

assert(
  shouldNudgeCachedSrcLoad({
    readyState: 0,
    networkState: NETWORK_IDLE,
    networkIdle: NETWORK_IDLE,
  }),
  "idle cached mount must call load() so Safari attaches the preloaded src",
);

assert(
  !shouldNudgeCachedSrcLoad({
    readyState: 0,
    networkState: NETWORK_LOADING,
    networkIdle: NETWORK_IDLE,
  }),
  "do not interrupt an in-flight fetch",
);

assert(
  !shouldNudgeCachedSrcLoad({
    readyState: FACE_VIDEO_FRAME_READY_STATE,
    networkState: NETWORK_IDLE,
    networkIdle: NETWORK_IDLE,
  }),
  "decoded clips do not need another load()",
);

console.log("faceVideoPlayback.self-check: ok");
