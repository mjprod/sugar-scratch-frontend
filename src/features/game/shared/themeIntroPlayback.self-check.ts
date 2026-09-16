/**
 * Theme-intro playback invariants (mute unlock + resume after epoch bump).
 * Run: npx tsx src/features/game/shared/themeIntroPlayback.self-check.ts
 */
import {
  applyBoundThemeIntroSound,
  bindThemeIntroVideo,
  playThemeIntro,
  retryThemeIntroPlayback,
  setThemeIntroSound,
  unbindThemeIntroVideo,
} from "./media";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

type FakeVideo = HTMLVideoElement & {
  _attrs: Map<string, string>;
  _listeners: Map<string, Set<() => void>>;
  _playImpl: () => Promise<void>;
  emit: (type: string) => void;
};

function makeFakeVideo(init?: {
  readyState?: number;
  paused?: boolean;
  playImpl?: () => Promise<void>;
}): FakeVideo {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const video = {
    muted: true,
    defaultMuted: true,
    volume: 1,
    paused: init?.paused ?? true,
    ended: false,
    readyState: init?.readyState ?? 0,
    videoWidth: init?.readyState && init.readyState >= 2 ? 390 : 0,
    playsInline: true,
    src: "https://example.test/intro.mp4",
    _attrs: attrs,
    _listeners: listeners,
    _playImpl:
      init?.playImpl ??
      (async () => {
        video.paused = false;
      }),
    hasAttribute(name: string) {
      return attrs.has(name);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    addEventListener(type: string, fn: () => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
    emit(type: string) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    async play() {
      await video._playImpl();
    },
    load() {
      // no-op
    },
  } as unknown as FakeVideo;
  return video;
}

// --- retryThemeIntroPlayback must not clear unlock / remute after gesture ---
{
  const video = makeFakeVideo({ readyState: 4, paused: true });
  setThemeIntroSound(video, true, { forceUnmute: true });
  assert(
    video.hasAttribute("data-intro-sound-unlocked"),
    "forceUnmute should mark intro unlocked",
  );
  assert(!video.muted, "forceUnmute should clear muted");

  retryThemeIntroPlayback(video);
  assert(
    video.hasAttribute("data-intro-sound-unlocked"),
    "retry must keep data-intro-sound-unlocked",
  );
  assert(
    !video.muted,
    "retry must not flip muted=true after unlock (WebKit silence bug)",
  );
  assert(!video.paused, "retry should call play()");
}

// --- retry without unlock may remute for autoplay ---
{
  const video = makeFakeVideo({ readyState: 4, paused: true });
  video.muted = false;
  video.removeAttribute("muted");
  retryThemeIntroPlayback(video);
  assert(video.muted, "cold retry may remute when never unlocked");
  assert(
    !video.hasAttribute("data-intro-sound-unlocked"),
    "cold retry must not invent an unlock",
  );
}

// --- playThemeIntro resumes after mute/unmute during canplay wait ---
{
  let playCalls = 0;
  const video = makeFakeVideo({
    readyState: 0,
    paused: true,
    playImpl: async () => {
      playCalls += 1;
      if (video.readyState < 2) {
        throw new Error("not ready");
      }
      video.paused = false;
    },
  });

  bindThemeIntroVideo(video);
  const pending = playThemeIntro(video, true);

  // Simulate user unmute while still waiting for canplay — play() fails (not ready).
  queue Promise.resolve().then(() => {
    applyBoundThemeIntroSound(true);
    assert(
      video.hasAttribute("data-intro-sound-unlocked"),
      "mute button unlocks intro",
    );
    // Element still not ready — leave paused so playThemeIntro must resume later.
    video.paused = true;
    video.readyState = 4;
    video.videoWidth = 390;
    video.emit("canplay");
  });

  const result = await pending;
  assert(result.playing, "playThemeIntro must resume after epoch bump + canplay");
  assert(playCalls >= 2, "must retry play() after the element becomes ready");
  unbindThemeIntroVideo(video);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policy:
        "retry never remutes after unlock; playThemeIntro resumes after epoch bump",
    },
    null,
    2,
  ),
);
