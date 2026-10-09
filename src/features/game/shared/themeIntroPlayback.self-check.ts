/**
 * Theme-intro playback invariants (mute unlock + resume after epoch bump).
 * Run: npx tsx src/features/game/shared/themeIntroPlayback.self-check.ts
 */

// media.ts uses window.setTimeout — stub before import.
(globalThis as { window?: unknown }).window = globalThis;

type FakeVideo = {
  muted: boolean;
  defaultMuted: boolean;
  volume: number;
  paused: boolean;
  ended: boolean;
  readyState: number;
  videoWidth: number;
  playsInline: boolean;
  src: string;
  hasAttribute: (name: string) => boolean;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
  emit: (type: string) => void;
  play: () => Promise<void>;
  load: () => void;
};

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function asVideo(video: FakeVideo): HTMLVideoElement {
  return video as unknown as HTMLVideoElement;
}

function makeFakeVideo(init?: {
  readyState?: number;
  paused?: boolean;
  playImpl?: (video: FakeVideo) => Promise<void>;
}): FakeVideo {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const video: FakeVideo = {
    muted: true,
    defaultMuted: true,
    volume: 1,
    paused: init?.paused ?? true,
    ended: false,
    readyState: init?.readyState ?? 0,
    videoWidth: init?.readyState && init.readyState >= 2 ? 390 : 0,
    playsInline: true,
    src: "https://example.test/intro.mp4",
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
      if (init?.playImpl) await init.playImpl(video);
      else video.paused = false;
    },
    load() {
      // no-op
    },
  };
  return video;
}

async function main() {
  const {
    applyBoundThemeIntroSound,
    bindThemeIntroVideo,
    playThemeIntro,
    retryThemeIntroPlayback,
    setThemeIntroSound,
    unbindThemeIntroVideo,
  } = await import("./media");

  // retryThemeIntroPlayback must not clear unlock / remute after gesture
  const unlocked = makeFakeVideo({ readyState: 4, paused: true });
  setThemeIntroSound(asVideo(unlocked), true, { forceUnmute: true });
  assert(
    unlocked.hasAttribute("data-intro-sound-unlocked"),
    "forceUnmute should mark intro unlocked",
  );
  assert(!unlocked.muted, "forceUnmute should clear muted");
  retryThemeIntroPlayback(asVideo(unlocked));
  assert(
    unlocked.hasAttribute("data-intro-sound-unlocked"),
    "retry must keep data-intro-sound-unlocked",
  );
  assert(
    !unlocked.muted,
    "retry must not flip muted=true after unlock (WebKit silence bug)",
  );
  assert(!unlocked.paused, "retry should call play()");

  // retry without unlock may remute for autoplay
  const cold = makeFakeVideo({ readyState: 4, paused: true });
  cold.muted = false;
  cold.removeAttribute("muted");
  retryThemeIntroPlayback(asVideo(cold));
  assert(cold.muted, "cold retry may remute when never unlocked");
  assert(
    !cold.hasAttribute("data-intro-sound-unlocked"),
    "cold retry must not invent an unlock",
  );

  // playThemeIntro resumes after mute/unmute during canplay wait
  let playCalls = 0;
  const waiting = makeFakeVideo({
    readyState: 0,
    paused: true,
    playImpl: async (v) => {
      playCalls += 1;
      if (v.readyState < 2) {
        throw new Error("not ready");
      }
      v.paused = false;
    },
  });

  bindThemeIntroVideo(asVideo(waiting));
  const pending = playThemeIntro(asVideo(waiting), true);

  // Simulate user unmute while still waiting for canplay — play() fails (not ready).
  await Promise.resolve();
  applyBoundThemeIntroSound(true);
  assert(
    waiting.hasAttribute("data-intro-sound-unlocked"),
    "mute button unlocks intro",
  );
  // Element still not ready — leave paused so playThemeIntro must resume later.
  waiting.paused = true;
  waiting.readyState = 4;
  waiting.videoWidth = 390;
  waiting.emit("canplay");

  const result = await pending;
  assert(
    result.playing,
    "playThemeIntro must resume after epoch bump + canplay",
  );
  assert(playCalls >= 2, "must retry play() after the element becomes ready");
  unbindThemeIntroVideo(asVideo(waiting));

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
}

void main();
