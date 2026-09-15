import { collectionReturnHref } from "@/shared/navigation/collectionReturn";
import { settlePackMotionCard } from "@/services/packMotionSettle";
import {
  getGameAudioPrefs,
  setSoundEffectEnabled,
  subscribeGameAudioPrefs,
} from "@/services/gameAudioPrefs";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import { Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  FairyDustCursor,
  fairyDustPerf,
  resetFairyDustPerfPeak,
  type ParticleType,
} from "../cursorFx/FairyDustCursor";
import { loadLottieUrlSource } from "../cursorFx/loadLottieSource";
import { GameSymbolIcon } from "../modules/GameSymbolIcon";
import { MatchFlight } from "../modules/MatchFlight";
import {
  InitialCountdown,
  isCountdownSoundUnlocked,
  TOP_BAR_DOCK_MS,
  TOP_BAR_DOCK_NEXT_CARD_MS,
  unlockCountdownSound,
} from "../modules/InitialCountdown";
import {
  ScratchFrameProgress,
  type SymbolDiscoveryBatch,
} from "../modules/ScratchFrameProgress";
import { GamePauseButton } from "../GamePauseButton";
import { StageMuteButton } from "../StageMuteButton";
import {
  TOP_BAR_SHOWCASE_MS,
  TopSymbolBar,
  type TopBarPhase,
} from "../modules/TopSymbolBar";
import { MotionWinReveal } from "../modules/MotionWinReveal";
import { NoMatchOutcome } from "../modules/NoMatchOutcome";
import {
  awardMotionCardPhotos,
  clearPendingMotionResult,
  finishMotionHand,
  isGameModeUrl,
  loadGameSession,
  navigateTo,
  recordMotionCardResult,
  themeForMotionCard,
  type GameSession,
} from "../modules/gameSession";
import {
  inferThemeFromLabel,
  loadGameCatalog,
  type PhotoCard,
} from "../modules/session";
import {
  advanceHuntHintCycle,
  applyBodyFindHits,
  buildBodySymbols,
  buildTopSymbols,
  claimNextTopSlot,
  loadSymbolTypes,
  matchedTopSlots,
  resolveHuntPhase,
  resolveMatchGame,
  resolveScratchOutcome,
  SYMBOL_TYPE_COUNT,
  SYMBOL_TYPES,
  TOP_SYMBOL_COUNT,
  type HuntHintCycle,
  type MatchGameOutcome,
} from "../modules/matchGame";
import { PackProgress } from "../modules/PackProgress";
import {
  COIN_BADGE_IDLE_HIDE_MS,
  rollSparkleCoin,
} from "../modules/sparkleCoinAward";
import { StageCoinCount } from "../StageCoinCount";
import { getSymbolRotationStats } from "../modules/symbolPlaybackRotation";
import {
  createFabricAlphaCache,
  createSymbolScratchProbeCache,
  isSymbolNearAnyStroke,
  isSymbolNearStroke,
  readCachedFabricAlpha,
  readCachedSymbolScratchAmount,
  writeCachedFabricAlpha,
  writeCachedSymbolScratchAmount,
} from "../modules/scratchProbeCache";
import {
  clearPendingScratchMove,
  createScratchInputCoalesce,
  notePendingScratchMove,
  takePendingScratchMove,
} from "../modules/scratchInputCoalesce";
import {
  clearScratchMarks,
  createScratchMarksRing,
  pushScratchMark,
  scratchMarksSome,
} from "../modules/scratchMarksRing";
import { resolveGameCanvasPixelRatio } from "../modules/gameCanvasPixelRatio";
import {
  preloadLottieUrls,
  shouldFreezeSymbolLottie,
  shouldPreferStaticSymbolLottie,
} from "../modules/symbolLottiePolicy";
import {
  createThrottledUiClock,
  shouldPublishThrottledUi,
} from "../modules/scratchUiThrottle";
import { shouldUpdateBodyMarkers, shouldUpdateChestFollow } from "../modules/chestFollowGate";
import {
  shouldSampleFabricAlpha,
  shouldSpawnFairyDust,
} from "../modules/fairyDustSpawnPolicy";
import { shouldHalfRateBottomUploads } from "../modules/halfRateBottom";
import {
  resolveAutoScratchBudget,
  resolveManualScratchBudget,
} from "../modules/scratchStampBudget";
import {
  createVideoSyncState,
  decideVideoSync,
  shortestMediaDrift,
  type VideoSyncState,
} from "../modules/videoSync";
import {
  celebrateParticleBoost,
  crossedProgressMilestone,
  CURSOR_FX_CELEBRATE_MS,
  resolveCursorFxDeviceProfile,
} from "../modules/cursorFxCelebrate";
import {
  fetchCatalogMotionCards,
} from "../shared/catalog";
import {
  loadVideoSrc,
  playThemeIntro,
  releaseMediaElement,
} from "../shared/media";
import { fetchThemes } from "../shared/themes";
import {
  MirrorSlideTransition,
  nextTemplateId,
  type TransitionTemplateId,
} from "../videoTransition";
import { GarmentGLRenderer, PRESENT_ZOOM } from "./glRenderer";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  parseTrackedMesh,
  sampleMeshUvToWorld,
  sampleTrackedMesh,
  SYMBOL_POINT_COUNT,
  trackedWorldToUv,
  type TrackedMesh,
  type TrackedMeshSample,
  type Vec2,
} from "./meshGeometry";
import { fetchModels, type ModelInfo } from "./models";

// On-screen diagnostics (FPS, layer drift, raw video state) shown only when the
// page is opened with ?debug=1. Self-contained: it polls the DOM/video elements
// directly so it adds no coupling to the render loop. Used to debug Safari, which
// can't be driven from the dev tooling here.
function DebugHud() {
  const [lines, setLines] = useState<string[]>(["debug: starting…"]);

  useEffect(() => {
    let frames = 0;
    let rafId = 0;
    // Per-video: how many distinct currentTime values we saw (= delivered video
    // frames) and the last value, so we can report the *effective* playback fps
    // separately from the render fps. A low video fps while render fps stays high
    // is the signature of decode stutter (the canvas redraws fine, but it's
    // showing the same decoded frame repeatedly).
    const vstate = new Map<HTMLVideoElement, { last: number; count: number }>();
    const samples: Array<{
      t: number;
      fps: number;
      heapMb: number | null;
      symReady: number;
      symPlaying: number;
      symTotal: number;
      iconCanvases: number;
      missed: number;
      dormant: number;
      fxActive: number;
    }> = [];
    const tick = () => {
      frames += 1;
      for (const v of document.querySelectorAll<HTMLVideoElement>(
        ".source-video",
      )) {
        const s = vstate.get(v);
        if (!s) {
          vstate.set(v, { last: v.currentTime, count: 0 });
        } else if (v.currentTime !== s.last) {
          s.last = v.currentTime;
          s.count += 1;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    let last = performance.now();
    let peakHeap = 0;
    const startedAt = performance.now();
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(1, now - last);
      const fps = Math.round((frames * 1000) / elapsed);
      frames = 0;
      last = now;

      const vids = Array.from(
        document.querySelectorAll<HTMLVideoElement>(".source-video"),
      );
      const [bottom, foreground] = vids;
      const out: string[] = [`render ${fps}fps`];

      // Cursor FX cost: concurrent particles drive drawImage count; fadeSpeed
      // and particles-per-move are the main knobs that grow this under load.
      const fx = fairyDustPerf;
      out.push(
        `fx ${fx.active} particles (peak ${fx.peak}) ${fx.avgFrameMs.toFixed(2)}ms avg`,
      );

      // Symbol Lottie rotation — after miss/dormant freeze, ready should stay
      // near hit-count only (not all 12–18 icons).
      const sym = getSymbolRotationStats();
      const iconCanvases = document.querySelectorAll(
        ".game-symbol-lottie canvas",
      ).length;
      const missed = document.querySelectorAll(
        ".body-symbol-marker.is-missed",
      ).length;
      const dormant = document.querySelectorAll(
        ".top-symbol-slot.is-dormant",
      ).length;
      out.push(
        `sym rot ${sym.playing}/${sym.ready} ready · ${sym.total} joined (cap ${sym.maxConcurrent})`,
      );
      out.push(
        `sym ui ${iconCanvases} canvases · ${missed} missed · ${dormant} dormant`,
      );

      // JS heap usage. performance.memory is non-standard (Chromium only) but
      // works on plain http/localhost — unlike measureUserAgentSpecificMemory,
      // which needs cross-origin isolation. Safari exposes neither, so we note
      // it as unavailable there.
      const mem = (
        performance as Performance & {
          memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        }
      ).memory;
      const mb = (n: number) => (n / 1048576).toFixed(1);
      let heapMb: number | null = null;
      if (mem) {
        // Show one decimal + running peak so small allocations are visible; the
        // whole-MB rounding before made it look frozen. NOTE: this is only the JS
        // heap — GPU textures and video decode buffers (what actually grows while
        // scratching) live outside it, so use Chrome's Task Manager for true RAM.
        if (mem.usedJSHeapSize > peakHeap) peakHeap = mem.usedJSHeapSize;
        heapMb = mem.usedJSHeapSize / 1048576;
        out.push(
          `heap ${mb(mem.usedJSHeapSize)}MB peak ${mb(peakHeap)} (lim ${mb(mem.jsHeapSizeLimit)})`,
        );
      } else {
        out.push("heap n/a (no perf.memory)");
      }
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
        .deviceMemory;
      if (deviceMemory) out.push(`devMem ~${deviceMemory}GB`);

      if (bottom && foreground) {
        const drift = bottom.currentTime - foreground.currentTime;
        out.push(
          `drift ${drift.toFixed(3)}s  fgRate ${foreground.playbackRate.toFixed(3)}`,
        );
      }
      vids.forEach((v, i) => {
        const tag = i === 0 ? "btm" : "fg ";
        const s = vstate.get(v);
        const vfps = s ? Math.round((s.count * 1000) / elapsed) : 0;
        if (s) s.count = 0;
        out.push(
          `${tag} ${vfps}vfps rs${v.readyState} ${v.paused ? "PAUSED" : "play"}${v.seeking ? " SEEK" : ""} t${v.currentTime.toFixed(2)}${v.error ? ` ERR${v.error.code}` : ""}`,
        );
      });

      samples.push({
        t: Math.round(now - startedAt),
        fps,
        heapMb,
        symReady: sym.ready,
        symPlaying: sym.playing,
        symTotal: sym.total,
        iconCanvases,
        missed,
        dormant,
        fxActive: fx.active,
      });
      if (samples.length > 360) samples.splice(0, samples.length - 360);

      (
        window as Window & {
          __scratchPerf?: {
            latest: (typeof samples)[number] | null;
            samples: typeof samples;
            peakHeapMb: number;
          };
        }
      ).__scratchPerf = {
        latest: samples[samples.length - 1] ?? null,
        samples,
        peakHeapMb: peakHeap / 1048576,
      };

      setLines(out);
    }, 500);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      delete (window as Window & { __scratchPerf?: unknown }).__scratchPerf;
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        left: 6,
        zIndex: 50,
        padding: "6px 8px",
        background: "oklch(0 0 0 / 0.72)",
        color: "oklch(0.868 0.294 142.5)",
        font: "11px/1.35 ui-monospace, Menlo, monospace",
        whiteSpace: "pre",
        borderRadius: 6,
        pointerEvents: "none",
        maxWidth: "92%",
      }}
    >
      {lines.join("\n")}
    </div>
  );
}

// A coin that animates from the scratch origin up to a symbol slot in the top
// bar each time a new symbol ("coin") is earned. Positions are stage-relative
// pixels; the CSS keyframe arcs the coin from `from*` to `to*`.
type FlyingCoin = {
  id: number;
  typeId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Waypoint for the plain `coinFly` keyframe. Match flights compute their
      own bezier control point, so they leave these unset. */
  midX?: number;
  midY?: number;
  delayMs: number;
  /** Body-hunt match flight: source body index + destination top slot. */
  bodyIndex?: number;
  topSlot?: number;
};

const COIN_FLIGHT_DURATION_MS = 620;
const COIN_FLIGHT_STAGGER_MS = 80;
const MATCH_FLIGHT_STAGGER_MS = 90;
// A card pairs the reveal (bottom) video, the green-screen foreground video, and
// the tracked mesh generated from that foreground. Switching cards swaps all
// three together so the scratch holes line up with the right clip.
type Card = {
  id: string;
  label: string;
  bottom: string;
  foreground: string;
  mesh: string;
  chromaKey: boolean;
  model_id?: string;
  /** Catalog theme id (police/nurse/…) — drives the theme intro clip. */
  theme_id?: string;
  sort_order?: number;
  photos?: Array<{ id: string; src: string }>;
};

const DEFAULT_CARDS: Card[] = [
  {
    id: "original",
    label: "Original",
    bottom: "/cards/ai%20girl%202.mp4",
    foreground: "/cards/Green%20bg%20sample%202%20swap.mp4",
    mesh: "tracked-mesh.json",
    chromaKey: true,
  },
  {
    id: "girl_1",
    label: "Girl 1",
    bottom: "/cards/girl_1/background.mp4",
    foreground: "/cards/girl_1/foreground.mp4",
    mesh: "girl_1.json",
    chromaKey: false,
  },
  {
    id: "girl_2",
    label: "Girl 2",
    bottom: "/cards/girl_2/background.mp4",
    foreground: "/cards/girl_2/foreground.mp4",
    mesh: "girl_2.json",
    chromaKey: false,
  },
  {
    id: "juliana_1",
    label: "Julianaval Cop 2",
    bottom: "/cards/juliana_1/background.mp4",
    foreground: "/cards/juliana_1/foreground.mp4",
    mesh: "juliana_1.json",
    chromaKey: false,
    model_id: "julianaval",
  },
  {
    id: "juliana_2",
    label: "Julianaval Nurse",
    bottom: "/cards/juliana_2/background.mp4",
    foreground: "/cards/juliana_2/foreground.mp4",
    mesh: "juliana_2.json",
    chromaKey: false,
    model_id: "julianaval",
  },
  {
    id: "chinese_1",
    label: "Chinese 1",
    bottom: "/cards/chinese_1/background.mp4",
    foreground: "/cards/chinese_1/foreground.mp4",
    mesh: "chinese_1.json",
    chromaKey: false,
  },
];

function playlistCardsForModel(cards: Card[], modelId: string): Card[] {
  return cards
    .filter((entry) => entry.model_id === modelId)
    .sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });
}

function playlistCardsForGameSession(
  cards: Card[],
  session: GameSession,
): Card[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered: Card[] = [];
  for (const id of session.motionCardIds) {
    const card = byId.get(id);
    if (card) ordered.push(card);
  }
  return ordered;
}

async function loadCards(): Promise<Card[]> {
  try {
    const cards = await fetchCatalogMotionCards();
    return cards.length > 0 ? cards : DEFAULT_CARDS;
  } catch {
    return DEFAULT_CARDS;
  }
}

const MESH_INDEX_SRC = "/mesh/index.json";
const MESH_DIRECTORY_SRC = "/mesh";
const DEFAULT_MESH_FILE = "tracked-mesh.json";
const SYMBOL_SLOT_COUNT = SYMBOL_POINT_COUNT;
const SYMBOL_REVEAL_STEP_MANUAL = 0.056;
const SYMBOL_REVEAL_STEP_AUTO = 0.083;
const FULL_REVEAL_MANUAL_THRESHOLD = 0.7;
const GAME_OUTCOME_OVERLAY_PAD_MS = 300;
const GAME_OUTCOME_SILENT_DELAY_MS = 1500;
const UI_STATE_UPDATE_INTERVAL_MS = 250;
/** Brief hold→dissolve so the scratch-to-start bar can be the hero beat. */
const INTRO_REVEAL_MS = 380;
const SCRATCH_ZOOM_STORAGE_KEY = "sugar-scratchie:scratch-zoom-v2";
const LEGACY_SCRATCH_ZOOM_STORAGE_KEYS = ["sugar-scratchie:scratch-zoom"];
// Slightly larger than the manual brush so a scratch that covers the mark counts.
/** Skip GPU sample when the stroke is nowhere near the symbol. */
const SYMBOL_REVEAL_UV_RADIUS = 0.06;
/** Require the scratch map itself to be clear at the symbol UV — stops icons
 * floating over still-opaque clothing just because a stroke passed nearby. */
const SYMBOL_SCRATCH_REVEAL_THRESHOLD = 0.55;
/** Lottie backing store matches the CSS marker so the find-bounce doesn't
 * upscale a soft canvas. */
const BODY_SYMBOL_ICON_PX = 44;

type ScratchZoomSettings = {
  enabled: boolean;
  scale: number;
  durationMs: number;
  bounce: boolean;
};

const SCRATCH_ZOOM_DEFAULTS: ScratchZoomSettings = {
  enabled: false,
  scale: 1.35,
  durationMs: 180,
  bounce: false,
};

function buildSessionSymbols(): number[] {
  return buildBodySymbols();
}

function revealedSymbolCount(progress: number, autoMode: boolean) {
  const step = autoMode ? SYMBOL_REVEAL_STEP_AUTO : SYMBOL_REVEAL_STEP_MANUAL;
  return Math.min(SYMBOL_SLOT_COUNT, Math.floor(progress / step));
}

function isGarmentFullyRevealed(
  progress: number,
  revealedCount: number,
  sampleCount: number,
  autoMode: boolean,
) {
  if (sampleCount === 0) return false;
  if (autoMode) {
    return revealedCount >= sampleCount;
  }
  return (
    progress >= FULL_REVEAL_MANUAL_THRESHOLD ||
    revealedCount >= Math.ceil(sampleCount * FULL_REVEAL_MANUAL_THRESHOLD)
  );
}

type GameResult = "win" | "lose";

const DESKTOP_SETTINGS_TABS = [
  { id: "scratch-zoom", label: "Scratch zoom" },
  { id: "sound", label: "Sound" },
  { id: "auto-scratch", label: "Auto scratch" },
  { id: "cursor-fx", label: "Cursor FX" },
] as const;

type DesktopSettingsTab = (typeof DESKTOP_SETTINGS_TABS)[number]["id"];

// One chromatic note per symbol slot (C5 → B5); slot index always maps to the same pitch.
const SYMBOL_NOTE_BASE_HZ = 523.25;
const SYMBOL_NOTE_DURATION_S = 0.32;

type SymbolAudioState = {
  ctx: AudioContext | null;
};

function ensureSymbolAudio(state: SymbolAudioState) {
  if (typeof window === "undefined") return null;
  if (!state.ctx) {
    const AudioCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return null;
    state.ctx = new AudioCtor();
  }
  if (state.ctx.state === "suspended") void state.ctx.resume();
  return state.ctx;
}

function symbolSlotFrequency(slotIndex: number) {
  return SYMBOL_NOTE_BASE_HZ * 2 ** (slotIndex / SYMBOL_SLOT_COUNT);
}

function playSymbolSlotNote(state: SymbolAudioState, slotIndex: number) {
  const ctx = ensureSymbolAudio(state);
  if (!ctx || slotIndex < 0 || slotIndex >= SYMBOL_SLOT_COUNT) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(symbolSlotFrequency(slotIndex), now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + SYMBOL_NOTE_DURATION_S);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + SYMBOL_NOTE_DURATION_S + 0.02);
}

function playNewSymbolNotes(
  state: SymbolAudioState,
  prevCount: number,
  nextCount: number,
  enabled: boolean,
) {
  if (!enabled) return;
  for (let slot = prevCount; slot < nextCount; slot += 1) {
    playSymbolSlotNote(state, slot);
  }
}

function playMatchFindSound(
  state: SymbolAudioState,
  enabled: boolean,
  startOffsetS = 0,
) {
  if (!enabled) return;
  const ctx = ensureSymbolAudio(state);
  if (!ctx) return;
  const t = ctx.currentTime + startOffsetS;
  // Bright ascending ding — claims a top-bar slot.
  scheduleTone(ctx, t, 659.25, 0.1, 0.2, "triangle");
  scheduleTone(ctx, t + 0.055, 880, 0.12, 0.18, "sine");
  scheduleTone(ctx, t + 0.11, 1174.66, 0.14, 0.12, "sine");
}

/** Per newly revealed body icon: ding only when it claims a top-bar slot. */
function playBodyFindSounds(
  state: SymbolAudioState,
  top: number[],
  body: number[],
  revealedBefore: readonly boolean[],
  newlyRevealed: readonly number[],
  enabled: boolean,
) {
  if (!enabled || newlyRevealed.length === 0) return;
  const revealed = revealedBefore.slice();
  newlyRevealed.forEach((index, i) => {
    const before = matchedTopSlots(top, body, revealed).filter(Boolean).length;
    revealed[index] = true;
    const after = matchedTopSlots(top, body, revealed).filter(Boolean).length;
    if (after > before) {
      playMatchFindSound(state, true, i * 0.07);
    }
  });
}

function scheduleTone(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  durationS: number,
  volume: number,
  type: OscillatorType = "triangle",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationS);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationS + 0.02);
}

function playGameOutcomeSound(
  state: SymbolAudioState,
  outcome: GameResult,
  enabled: boolean,
): number {
  if (!enabled) return GAME_OUTCOME_SILENT_DELAY_MS;

  const ctx = ensureSymbolAudio(state);
  if (!ctx) return 1800;

  const now = ctx.currentTime;

  if (outcome === "win") {
    const sparkle = [
      523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1174.66, 1318.51,
      1567.98, 1760, 2093,
    ];
    const sparkleStep = 0.048;
    sparkle.forEach((freq, index) => {
      scheduleTone(ctx, now + index * sparkleStep, freq, 0.09, 0.17, "sine");
      if (index % 2 === 0) {
        scheduleTone(
          ctx,
          now + index * sparkleStep + 0.012,
          freq * 2,
          0.055,
          0.09,
          "triangle",
        );
      }
    });

    const fanfareStart = now + sparkle.length * sparkleStep + 0.06;
    const fanfare = [523.25, 659.25, 783.99, 987.77, 1174.66];
    fanfare.forEach((freq, index) => {
      const t = fanfareStart + index * 0.1;
      scheduleTone(ctx, t, freq, 0.15, 0.3, "square");
      scheduleTone(ctx, t, freq * 0.5, 0.15, 0.14, "sawtooth");
      scheduleTone(ctx, t + 0.04, freq * 1.5, 0.08, 0.08, "triangle");
    });

    const chordAt = fanfareStart + fanfare.length * 0.1 + 0.1;
    const chord = [261.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.51];
    chord.forEach((freq, index) => {
      const type: OscillatorType = index < 2 ? "sawtooth" : "triangle";
      scheduleTone(ctx, chordAt, freq, 0.78, index < 2 ? 0.11 : 0.13, type);
    });

    const glitterStart = chordAt + 0.12;
    const glitter = [2093, 2349, 2637, 2793, 3136, 3520];
    glitter.forEach((freq, index) => {
      scheduleTone(ctx, glitterStart + index * 0.045, freq, 0.11, 0.11, "sine");
    });

    const shimmerStart = glitterStart + glitter.length * 0.045 + 0.08;
    for (let i = 0; i < 6; i += 1) {
      scheduleTone(
        ctx,
        shimmerStart + i * 0.06,
        1760 + i * 110,
        0.07,
        0.09,
        "sine",
      );
    }

    const endTime = shimmerStart + 6 * 0.06 + 0.35;
    return (endTime - now) * 1000 + GAME_OUTCOME_OVERLAY_PAD_MS;
  }

  // No match is a resolved outcome, not a loss — a soft low chime that settles,
  // never a descending "you lost" sting.
  scheduleTone(ctx, now, 523.25, 0.34, 0.09, "sine");
  scheduleTone(ctx, now + 0.13, 392, 0.5, 0.075, "sine");
  return 700 + GAME_OUTCOME_OVERLAY_PAD_MS;
}

function scratchZoomEasing(bounce: boolean) {
  return bounce ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : "ease-out";
}

const loadSoundEnabled = () => getGameAudioPrefs().soundEffect;

// Rect-taking variant, for callers that project several points per frame: the
// two getBoundingClientRect reads are identical for every point, so hoisting
// them out of the loop turns 2N layout reads into 2.
function worldPointToStageWithRects(
  worldPoint: Vec2,
  canvasRect: DOMRect,
  stageRect: DOMRect,
  camera: { x: number; y: number },
  overscan = PRESENT_ZOOM,
): Vec2 {
  const zoom = Math.max(1, overscan);
  const refClipX = (worldPoint.x / CANVAS_WIDTH) * 2 - 1;
  const refClipY = 1 - (worldPoint.y / CANVAS_HEIGHT) * 2;
  const presentX = ((refClipX * zoom + camera.x + 1) / 2) * CANVAS_WIDTH;
  const presentY = ((1 - (refClipY * zoom + camera.y)) / 2) * CANVAS_HEIGHT;
  const clientX =
    canvasRect.left + (presentX / CANVAS_WIDTH) * canvasRect.width;
  const clientY =
    canvasRect.top + (presentY / CANVAS_HEIGHT) * canvasRect.height;
  return { x: clientX - stageRect.left, y: clientY - stageRect.top };
}

function worldPointToStage(
  worldPoint: Vec2,
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  camera: { x: number; y: number },
  overscan = PRESENT_ZOOM,
): Vec2 {
  return worldPointToStageWithRects(
    worldPoint,
    canvas.getBoundingClientRect(),
    stage.getBoundingClientRect(),
    camera,
    overscan,
  );
}

function loadScratchZoomSettings(): ScratchZoomSettings {
  if (typeof window === "undefined") return SCRATCH_ZOOM_DEFAULTS;
  try {
    for (const key of LEGACY_SCRATCH_ZOOM_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem(SCRATCH_ZOOM_STORAGE_KEY);
    if (!raw) return SCRATCH_ZOOM_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ScratchZoomSettings>;
    return {
      enabled: parsed.enabled ?? SCRATCH_ZOOM_DEFAULTS.enabled,
      scale: clampValue(
        Number(parsed.scale) || SCRATCH_ZOOM_DEFAULTS.scale,
        1,
        2,
      ),
      durationMs: clampValue(
        Number(parsed.durationMs) || SCRATCH_ZOOM_DEFAULTS.durationMs,
        50,
        800,
      ),
      bounce: parsed.bounce ?? SCRATCH_ZOOM_DEFAULTS.bounce,
    };
  } catch {
    return SCRATCH_ZOOM_DEFAULTS;
  }
}

const AUTO_SCRATCH_STORAGE_KEY = "sugar-scratchie:auto-scratch";
const SCRATCH_RADIUS = 0.045;
// Densify / auto stamp caps live in scratchStampBudget (Phase 9 coarse vs fine).
const AUTO_SCRATCH_RADIUS = 0.092;
const AUTO_SCRATCH_DIAGONAL_LINES = 18;
// Step along each ↘ stroke (top-left → bottom-right) so brush circles overlap.
const AUTO_SCRATCH_PATH_STEP_UV = AUTO_SCRATCH_RADIUS * 0.72;

type AutoScratchSettings = {
  enabled: boolean;
  speed: number;
  flakes: boolean;
};

const AUTO_SCRATCH_DEFAULTS: AutoScratchSettings = {
  enabled: false,
  speed: 58,
  flakes: false,
};

function loadAutoScratchSettings(): AutoScratchSettings {
  if (typeof window === "undefined") return AUTO_SCRATCH_DEFAULTS;
  try {
    const raw = localStorage.getItem(AUTO_SCRATCH_STORAGE_KEY);
    if (!raw) return AUTO_SCRATCH_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AutoScratchSettings>;
    return {
      enabled: parsed.enabled ?? AUTO_SCRATCH_DEFAULTS.enabled,
      speed: clampValue(
        Number(parsed.speed) || AUTO_SCRATCH_DEFAULTS.speed,
        1,
        120,
      ),
      flakes: parsed.flakes ?? AUTO_SCRATCH_DEFAULTS.flakes,
    };
  } catch {
    return AUTO_SCRATCH_DEFAULTS;
  }
}

const CURSOR_FX_STORAGE_KEY = "sugar-scratchie:cursor-fx-v8";
const LEGACY_CURSOR_FX_STORAGE_KEYS = [
  "sugar-scratchie:cursor-fx",
  "sugar-scratchie:cursor-fx-v1",
  "sugar-scratchie:cursor-fx-v2",
  "sugar-scratchie:cursor-fx-v3",
  "sugar-scratchie:cursor-fx-v4",
  "sugar-scratchie:cursor-fx-v5",
  "sugar-scratchie:cursor-fx-v6",
  "sugar-scratchie:cursor-fx-v7",
];

type CursorFxSettings = {
  fairyDust: boolean;
  particleSize: number;
  particleCount: number;
  gravity: number;
  fadeSpeed: number;
};

function detectCursorFxDeviceProfile() {
  if (typeof window === "undefined") {
    return resolveCursorFxDeviceProfile({
      reducedMotion: false,
      coarsePointer: false,
      narrowViewport: false,
    });
  }
  return resolveCursorFxDeviceProfile({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    narrowViewport: window.matchMedia("(max-width: 700px)").matches,
  });
}

const CURSOR_FX_DEVICE = detectCursorFxDeviceProfile();

const CURSOR_FX_DEFAULTS: CursorFxSettings = {
  fairyDust: CURSOR_FX_DEVICE.fairyDust,
  particleSize: CURSOR_FX_DEVICE.particleSize,
  particleCount: CURSOR_FX_DEVICE.particleCount,
  gravity: 0.1,
  // Slightly longer life so a celebrate burst leaves a denser coin trail.
  fadeSpeed: 0.96,
};

const CURSOR_FX_INITIAL_VELOCITY = { min: 0.5, max: 1.5 };
/** Skip diamond-coin spawn on keyed-out / empty pixels. */
const CURSOR_FX_MESH_ALPHA_MIN = 0.12;

const CURSOR_FX_LOTTIE_PRESETS: { url: string; name: string }[] = [
  { url: "/cursor-fx/Diamond Coin.lottie", name: "Diamond Coin.lottie" },
  { url: "/cursor-fx/Diamond Coin.lottie", name: "Diamond Coin.lottie" },
  { url: "/cursor-fx/Diamond Coin.lottie", name: "Diamond Coin.lottie" },
  { url: "/cursor-fx/Diamond Coin.lottie", name: "Diamond Coin.lottie" },
];

function loadCursorFxSettings(): CursorFxSettings {
  if (typeof window === "undefined") return CURSOR_FX_DEFAULTS;
  for (const key of LEGACY_CURSOR_FX_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  try {
    const raw = localStorage.getItem(CURSOR_FX_STORAGE_KEY);
    if (!raw) return CURSOR_FX_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<CursorFxSettings>;
    return {
      fairyDust: parsed.fairyDust ?? CURSOR_FX_DEFAULTS.fairyDust,
      particleSize: clampValue(
        Number(parsed.particleSize) || CURSOR_FX_DEFAULTS.particleSize,
        10,
        64,
      ),
      particleCount: clampValue(
        Number(parsed.particleCount) || CURSOR_FX_DEFAULTS.particleCount,
        1,
        8,
      ),
      gravity: clampValue(
        Number(parsed.gravity) || CURSOR_FX_DEFAULTS.gravity,
        0,
        0.1,
      ),
      fadeSpeed: clampValue(
        Number(parsed.fadeSpeed) || CURSOR_FX_DEFAULTS.fadeSpeed,
        0.9,
        0.99,
      ),
    };
  } catch {
    return CURSOR_FX_DEFAULTS;
  }
}

function clampValue(value: number, lo: number, hi: number) {
  return value < lo ? lo : value > hi ? hi : value;
}

function foregroundTimeFromBottom(
  source: HTMLVideoElement,
  target: HTMLVideoElement,
) {
  const srcT = source.currentTime;
  const srcDur = source.duration;
  const tgtDur = target.duration;
  if (!Number.isFinite(srcT) || !Number.isFinite(tgtDur) || tgtDur <= 0)
    return srcT;
  if (
    Number.isFinite(srcDur) &&
    srcDur > 0 &&
    Math.abs(srcDur - tgtDur) <= 0.25
  ) {
    return Math.min(Math.max(0, srcT), tgtDur - 0.001);
  }
  return srcT % tgtDur;
}

// Subtle virtual camera that keeps the performer's chest near a fixed framing
// point. The chest anchor is a mesh-UV coordinate (roughly center, upper torso);
// each frame we sample where it lands and pan the presented shot toward the
// target. Pan is clamped small (and < PRESENT_ZOOM-1 so no edge shows) and
// smoothed so the move stays gentle.
const CHEST_ANCHOR_UV = { x: 0.5, y: 0.4 };
const CHEST_TARGET_UV = { x: 0.5, y: 0.4 };
const CHEST_FOLLOW_STRENGTH = 0.7;
const CHEST_CAM_MAX = Math.min(0.05, PRESENT_ZOOM - 1);
/** Slightly snappier than 0.08 so follow doesn't feel laggy behind the mesh. */
const CHEST_SMOOTH = 0.14;
/** Snap when within ~0.5px — stops asymptotic drip without stepping the pan. */
const CHEST_CAM_EPS = 1 / CANVAS_WIDTH;

// Show a pulsar on one unfound body mark at a time once this many (or fewer)
// remain, but only after the player has been idle for HINT_IDLE_MS. Hold each
// mark for HINT_PULSE_DWELL_MS, then pause HINT_PULSE_GAP_MS before the next.
const HINT_REMAINING_MAX = 3;
const HINT_IDLE_MS = 2200;
const HINT_PULSE_DWELL_MS = 2600;
const HINT_PULSE_GAP_MS = 1600;

// Bilinearly interpolate the deformed mesh at a fractional UV grid position to
// get its current canvas-pixel location (the mesh UV grid is regular 0..1).
// sampleMeshUvToWorld lives in meshGeometry.ts

// Dual-clip sync: prefer tolerating 1–2 frames over seeking. Loop wrap used to
// look like an ~duration discontinuity and fire an immediate hard seek (the
// multi-hundred-ms hitch). Shortest-path drift + cooldown on every seek softens
// that; see modules/videoSync.ts.
const videoSyncState = new WeakMap<HTMLVideoElement, VideoSyncState>();

function syncVideoTime(
  source: HTMLVideoElement,
  target: HTMLVideoElement,
  opts?: { isScratching?: boolean },
) {
  if (source.paused && !target.paused) {
    target.pause();
  }

  if (!source.paused && target.paused) {
    void target.play().catch(() => undefined);
  }

  if (
    !Number.isFinite(source.currentTime) ||
    !Number.isFinite(target.duration) ||
    target.duration <= 0
  ) {
    return;
  }

  // A seek hasn't landed yet (Safari resolves seeks asynchronously, and its
  // currentTime lags during one). Acting now would compare against a stale time
  // and pile on more seeks — a seek storm that looks like a hard stutter.
  if (target.seeking) return;

  // Let the foreground free-run at 1×. Continuously steering playbackRate
  // knocks Safari's video decoder off its smooth-decode path.
  if (target.playbackRate !== 1) target.playbackRate = 1;

  const targetTime = foregroundTimeFromBottom(source, target);
  const duration = target.duration;
  const actualTime = target.currentTime;
  const drift = shortestMediaDrift(targetTime, actualTime, duration);
  const now = performance.now();
  let state = videoSyncState.get(target);
  if (!state) {
    state = createVideoSyncState();
    videoSyncState.set(target, state);
  }

  const decision = decideVideoSync({
    drift,
    now,
    state,
    desiredTime: targetTime,
    actualTime,
    duration,
    isScratching: opts?.isScratching,
  });
  if (decision.action === "seek") {
    target.currentTime = targetTime;
  }
}

function parseMeshIndex(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { files?: unknown }).files)
  ) {
    return [];
  }

  return (value as { files: unknown[] }).files
    .filter((file): file is string => {
      return (
        typeof file === "string" &&
        file.toLowerCase().endsWith(".json") &&
        !file.includes("/")
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

// The fixed UV grid used to measure reveal progress. With a garment mask we keep
// only samples that land on clothing, so progress means "how much of the dress is
// scratched" (and can reach 100%), not how much of the whole screen.
function buildRevealSamples(mesh: TrackedMesh | null): Vec2[] {
  const samplesAcross = 13;
  const samplesDown = 18;
  const garment = mesh?.garment ?? null;
  const cols = mesh?.cols ?? 0;
  const rows = mesh?.rows ?? 0;
  const points: Vec2[] = [];

  for (let yIndex = 0; yIndex <= samplesDown; yIndex += 1) {
    for (let xIndex = 0; xIndex <= samplesAcross; xIndex += 1) {
      const u = xIndex / samplesAcross;
      const v = yIndex / samplesDown;
      if (garment && cols > 0 && rows > 0) {
        const col = Math.round(u * (cols - 1));
        const row = Math.round(v * (rows - 1));
        if (!garment[row * cols + col]) continue;
      }
      points.push({ x: u, y: v });
    }
  }

  return points;
}

function densifyScratchPath(points: Vec2[], maxStep: number): Vec2[] {
  if (points.length === 0) return [];
  const out: Vec2[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxStep) {
      out.push(b);
      continue;
    }
    const steps = Math.ceil(dist / maxStep);
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      out.push({ x: a.x + dx * t, y: a.y + dy * t });
    }
  }
  return out;
}

function densifyStrokeSegment(
  from: Vec2,
  to: Vec2,
  maxStep: number,
  maxPoints: number,
): Vec2[] {
  const points = densifyScratchPath([from, to], maxStep);
  if (points.length <= maxPoints) return points;
  const kept: Vec2[] = [points[0]];
  const lastIndex = points.length - 1;
  for (let i = 1; i < maxPoints - 1; i += 1) {
    const idx = Math.round((i / (maxPoints - 1)) * lastIndex);
    kept.push(points[idx]);
  }
  kept.push(points[lastIndex]);
  return kept;
}

function isGarmentUv(mesh: TrackedMesh | null, u: number, v: number) {
  const garment = mesh?.garment ?? null;
  const cols = mesh?.cols ?? 0;
  const rows = mesh?.rows ?? 0;
  if (!garment || cols <= 0 || rows <= 0) return true;
  const col = Math.round(clampValue(u, 0, 1) * (cols - 1));
  const row = Math.round(clampValue(v, 0, 1) * (rows - 1));
  return Boolean(garment[row * cols + col]);
}

// Parallel ↙ strokes (u+v = const): top → bottom on each line; lines sweep top-left → bottom-right.
function buildAutoScratchPath(mesh: TrackedMesh | null): Vec2[] {
  const lineCount = AUTO_SCRATCH_DIAGONAL_LINES;
  const lines: { startU: number; startV: number; points: Vec2[] }[] = [];

  for (let i = 0; i <= lineCount; i += 1) {
    const s = (i / lineCount) * 2;
    let startU: number;
    let startV: number;
    let endU: number;
    let endV: number;
    if (s <= 1) {
      // ↙ along u+v=s: top (high u, low v) → bottom (low u, high v)
      startU = s;
      startV = 0;
      endU = 0;
      endV = s;
    } else {
      const t = s - 1;
      startU = 1;
      startV = 1 - t;
      endU = 1 - t;
      endV = 1;
    }

    const span = Math.hypot(endU - startU, endV - startV);
    if (span < 1e-6) continue;

    const linePoints: Vec2[] = [];
    const stepsAlong = Math.max(
      2,
      Math.ceil(span / (AUTO_SCRATCH_PATH_STEP_UV * 1.8)),
    );
    for (let j = 0; j <= stepsAlong; j += 1) {
      const f = j / stepsAlong;
      const u = startU + (endU - startU) * f;
      const v = startV + (endV - startV) * f;
      if (!isGarmentUv(mesh, u, v)) continue;
      linePoints.push({ x: u, y: v });
    }
    if (linePoints.length === 0) continue;
    lines.push({
      startU: linePoints[0].x,
      startV: linePoints[0].y,
      points: linePoints,
    });
  }

  lines.sort((a, b) => {
    if (Math.abs(a.startV - b.startV) > 1e-4) return a.startV - b.startV;
    return a.startU - b.startU;
  });

  const sparse: Vec2[] = [];
  for (const line of lines) {
    sparse.push(...densifyScratchPath(line.points, AUTO_SCRATCH_PATH_STEP_UV));
  }
  return sparse;
}

export function ScratchPrototype({
  skipToPlay = false,
  onLeave,
  onFirstProgressMilestone,
  onRevealedSymbolsChange,
}: {
  /**
   * Lab/sandbox: skip intro video + foil bar scratch + countdown.
   * Open already in hunt play with the symbol bar docked at the top.
   */
  skipToPlay?: boolean;
  /** When set, pause control is rendered in the top chrome left gutter. */
  onLeave?: () => void;
  /**
   * Fires once the first time crossedProgressMilestone returns a band
   * (10% scratch progress). Used by /game-ui lab bonus diamond.
   */
  onFirstProgressMilestone?: () => void;
  /** Body/foil icons found so far (0…SYMBOL_SLOT_COUNT). Lab bonus diamond lock. */
  onRevealedSymbolsChange?: (count: number) => void;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // FairyDust must paint in stage space: the product embed wraps play in a
  // transformed phone frame, which makes position:fixed + clientX/Y land off-canvas.
  const [cursorHost, setCursorHost] = useState<HTMLDivElement | null>(null);
  const setStageNode = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    setCursorHost((current) => (current === node ? current : node));
  }, []);
  const symbolSlotRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Most recent pointer position in viewport coords; used as the origin of the
  // flying-coin animation for manual scratches.
  const lastPointerClientRef = useRef<Vec2 | null>(null);
  const coinIdRef = useRef(0);
  const [flyingCoins, setFlyingCoins] = useState<FlyingCoin[]>([]);
  const [, setSymbolCatalogTick] = useState(0);

  useEffect(() => {
    loadSymbolTypes()
      .then((ok) => {
        if (ok) setSymbolCatalogTick((n) => n + 1);
      })
      .catch(() => undefined);
  }, []);
  const bottomVideoRef = useRef<HTMLVideoElement | null>(null);
  const foregroundVideoRef = useRef<HTMLVideoElement | null>(null);
  /** After claim, FG is paused + rVFC-unhooked so it stops decoding. */
  const fgParkedRef = useRef(false);
  const glRendererRef = useRef<GarmentGLRenderer | null>(null);
  const marksRef = useRef(createScratchMarksRing());
  const scratchInputCoalesceRef = useRef(createScratchInputCoalesce());
  const hoverPointRef = useRef<Vec2 | null>(null);
  const lastScratchWorldRef = useRef<Vec2 | null>(null);
  const drawingRef = useRef(false);
  // Reveal progress is measured against a fixed UV sample grid. We track which
  // samples have *ever* been scratched (monotonic), so the percentage matches
  // the permanent scratch texture and never drops — even after marksRef is
  // capped or the fabric moves.
  const revealSamplesRef = useRef<Vec2[]>([]);
  const revealedRef = useRef<boolean[]>([]);
  const revealedCountRef = useRef(0);
  const [trackedMesh, setTrackedMesh] = useState<TrackedMesh | null>(null);
  const trackedSampleRef = useRef<TrackedMeshSample | null>(null);
  const trackedMeshRef = useRef<TrackedMesh | null>(null);
  trackedMeshRef.current = trackedMesh;
  // Smoothed chest-follow camera offset, in clip units. Read by getCanvasPoint
  // to invert the pan when mapping a tap back to fabric UV.
  const cameraRef = useRef({ x: 0, y: 0 });
  const [meshFiles, setMeshFiles] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>(DEFAULT_CARDS);
  const [models, setModels] = useState<ModelInfo[]>(() =>
    skipToPlay
      ? [{ id: "julianaval", label: "Juliana", avatar: null }]
      : [],
  );
  // Lab is ready immediately from DEFAULT_CARDS — no API wait for mobile preview.
  const [cardsReady, setCardsReady] = useState(() => skipToPlay);
  useMarkPageReady(cardsReady);
  const [selectedMeshFile, setSelectedMeshFile] = useState(() => {
    if (!skipToPlay) return DEFAULT_CARDS[1].mesh;
    if (typeof window === "undefined") return "juliana_1.json";
    const fromUrl =
      new URLSearchParams(window.location.search).get("card")?.trim() ||
      "juliana_1";
    return (
      DEFAULT_CARDS.find((entry) => entry.id === fromUrl)?.mesh ??
      "juliana_1.json"
    );
  });
  const [meshReloadToken, setMeshReloadToken] = useState(0);
  /** Lab only: bump to force the same card to fully reset after a find. */
  const [labRestartToken, setLabRestartToken] = useState(0);
  /**
   * /game-ui lab: TopSymbolBar normally force-reveals + docks for hunt UI.
   * Set false while iterating the center foil scratch → dock sequence.
   */
  const [labTopBarForceRevealed, setLabTopBarForceRevealed] = useState(
    () => skipToPlay,
  );
  const labDockPreviewTimerRef = useRef<number | null>(null);
  const [activeModelId, setActiveModelId] = useState(() => {
    if (typeof window === "undefined") return skipToPlay ? "julianaval" : "";
    return (
      new URLSearchParams(window.location.search).get("model")?.trim() ||
      (skipToPlay ? "julianaval" : "")
    );
  });
  const [selectedCardId, setSelectedCardId] = useState(() => {
    if (typeof window === "undefined") return skipToPlay ? "juliana_1" : "";
    return (
      new URLSearchParams(window.location.search).get("card")?.trim() ||
      (skipToPlay ? "juliana_1" : "")
    );
  });
  /** StageNav / bare /game → full model hand. Collection Play Game omits playlist=1. */
  const [playlistMode, setPlaylistMode] = useState(() => {
    if (typeof window === "undefined") return false;
    if (skipToPlay) return false;
    return new URLSearchParams(window.location.search).get("playlist") === "1";
  });
  /** Locked card for single-play so clearing selectedCardId doesn't empty the hand. */
  const singleCardIdRef = useRef(
    (() => {
      if (typeof window === "undefined") {
        return skipToPlay ? "juliana_1" : "";
      }
      if (skipToPlay) {
        return (
          new URLSearchParams(window.location.search).get("card")?.trim() ||
          "juliana_1"
        );
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get("playlist") === "1" || isGameModeUrl()) return "";
      return params.get("card")?.trim() || "";
    })(),
  );
  const [gameSession, setGameSession] = useState<GameSession | null>(() => {
    if (typeof window === "undefined" || !isGameModeUrl()) return null;
    const session = loadGameSession();
    return session?.phase === "motion" ? session : null;
  });
  const gameMode = Boolean(gameSession);
  const modelCards = useMemo(() => {
    if (gameSession) return playlistCardsForGameSession(cards, gameSession);
    if (!activeModelId) return [];
    if (playlistMode) return playlistCardsForModel(cards, activeModelId);
    const id = singleCardIdRef.current || selectedCardId;
    if (!id) return [];
    const one = cards.find(
      (entry) =>
        entry.id === id &&
        (entry.model_id === activeModelId || !entry.model_id),
    );
    return one ? [one] : [];
  }, [activeModelId, cards, gameSession, playlistMode, selectedCardId]);
  const [completedCardIds, setCompletedCardIds] = useState<string[]>(
    () => gameSession?.completedMotionIds ?? [],
  );
  const completedCardIdsRef = useRef<string[]>([]);
  completedCardIdsRef.current = completedCardIds;
  const remainingCards = useMemo(
    () => modelCards.filter((entry) => !completedCardIds.includes(entry.id)),
    [modelCards, completedCardIds],
  );
  const [motionResult, setMotionResult] = useState<{
    win: boolean;
    photos: PhotoCard[];
    current: number;
    total: number;
    resultId: string;
  } | null>(null);
  const [packRevealFailed, setPackRevealFailed] = useState(false);
  const [packRevealRetrying, setPackRevealRetrying] = useState(false);
  const packRevealBlockedRef = useRef(false);
  const motionResultRef = useRef(motionResult);
  motionResultRef.current = motionResult;
  const activeModel =
    models.find((entry) => entry.id === activeModelId) ?? null;
  // Never fall back to another girl's card — only play cards owned by the active model
  // (or the curated game-session hand).
  const card = useMemo(() => {
    if (modelCards.length === 0) return null;
    if (!gameMode && !activeModelId) return null;
    return (
      remainingCards.find((entry) => entry.id === selectedCardId) ??
      (motionResult
        ? (modelCards.find((entry) => entry.id === selectedCardId) ?? null)
        : null) ??
      remainingCards[0] ??
      null
    );
  }, [
    activeModelId,
    gameMode,
    modelCards,
    remainingCards,
    selectedCardId,
    motionResult,
  ]);
  const hasPlayableCard = Boolean(card);
  // Don't flash the girl picker while cards are still loading — that unmounts
  // the stage/videos and forces a cold dual-decoder attach (lag + desync).
  const showModelPicker =
    cardsReady && !gameMode && (!activeModelId || modelCards.length === 0);
  const playlistFinished =
    (gameMode || Boolean(activeModelId)) &&
    modelCards.length > 0 &&
    remainingCards.length === 0;
  const chromaKeyRef = useRef(card?.chromaKey ?? false);
  chromaKeyRef.current = card?.chromaKey ?? false;
  const advanceAfterScratchRef = useRef<() => void>(() => undefined);
  const transitionTemplateIndexRef = useRef(0);
  const cardTransitionActiveRef = useRef(false);
  type CardTransitionState = {
    fromBottom: string;
    toForeground: string;
    templateId: TransitionTemplateId;
    nextCardId: string;
    finishedId: string;
    prize: number;
  };
  const [cardTransition, setCardTransition] =
    useState<CardTransitionState | null>(null);
  const cardTransitionHandoffRef = useRef(false);
  const [cardTransitionReady, setCardTransitionReady] = useState(false);
  // Mesh lattice is a dev overlay — start hidden; toggle with "Show mesh".
  const [showMesh, setShowMesh] = useState(false);
  const showMeshRef = useRef(showMesh);
  showMeshRef.current = showMesh;
  const bodyMarkerRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Last styles written to each body marker, so the render loop can skip
  // redundant DOM writes. See the marker loop in render() for why.
  const bodyMarkerStyleRef = useRef<
    ({
      el: HTMLDivElement;
      transform: string;
      revealed: boolean | null;
    } | null)[]
  >([]);
  /** Throttle getBoundingClientRect — layout is stable between resizes. */
  const bodyMarkerLayoutRef = useRef<{
    canvasRect: DOMRect | null;
    stageRect: DOMRect | null;
    framesUntilRefresh: number;
  }>({ canvasRect: null, stageRect: null, framesUntilRefresh: 0 });
  /** Single shared pulsar — repositioned onto one unfound mark at a time. */
  const huntPulsarRef = useRef<HTMLDivElement | null>(null);
  const huntPulsarStyleRef = useRef({
    transform: "",
    active: false,
    index: -1,
  });
  /** Last scratch / pointer activity — pulsars wait HINT_IDLE_MS after this. */
  const huntHintActivityAtRef = useRef(performance.now());
  /** One-at-a-time pulsar: show one mark, then gap, then the next. */
  const huntHintCycleRef = useRef<HuntHintCycle>({
    index: -1,
    shownAt: 0,
    phase: "show",
  });
  const useBodySymbolsRef = useRef(false);
  const revealedPointsRef = useRef<boolean[]>(
    Array.from({ length: SYMBOL_SLOT_COUNT }, () => false),
  );
  const useBodySymbols =
    trackedMesh?.symbolPoints?.length === SYMBOL_SLOT_COUNT;
  useBodySymbolsRef.current = useBodySymbols;
  const [progress, setProgress] = useState(0);
  // Mirrors drawingRef for the body-symbol icons, which hold their animation
  // while a stroke is in progress — that is exactly the window where the two
  // videos compete with Lottie for the main thread. Flips twice per stroke, not
  // per move, so it does not add render churn to the drag itself.
  const [isScratching, setIsScratching] = useState(false);
  /** Cards-left pill: visible until first scratch touch, then animates out. */
  const [packProgressShown, setPackProgressShown] = useState(true);
  const [packProgressLeaving, setPackProgressLeaving] = useState(false);
  /** True only while the active stroke maps onto the deforming mesh. */
  const [cursorOnMesh, setCursorOnMesh] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [, setGameResultLeaving] = useState(false);
  const [matchOutcome, setMatchOutcome] = useState<MatchGameOutcome | null>(
    null,
  );
  const matchOutcomeRef = useRef<MatchGameOutcome | null>(null);
  const [topSymbols, setTopSymbols] = useState(buildTopSymbols);
  const [topBarPhase, setTopBarPhase] = useState<TopBarPhase>(() =>
    skipToPlay ? "docked" : "center",
  );
  const [topBarRound, setTopBarRound] = useState(0);
  /** Locks body scratch / video from dock through countdown end. */
  const [introGateActive, setIntroGateActive] = useState(false);
  const [showIntroCountdown, setShowIntroCountdown] = useState(false);
  /** Theme intro clip for the current Play/Continue visit (game mode only). */
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  /** Intro owns the decoder; game clips stay unloaded while this is true. */
  const [introActive, setIntroActive] = useState(false);
  /** Overlay still covers the stage (playing, holding last frame, or fading). */
  const [introCover, setIntroCover] = useState(false);
  /** Crossfading the frozen intro out over the live game stage. */
  const [introLeaving, setIntroLeaving] = useState(false);
  /** Starts muted for autoplay policy; may unmute after playThemeIntro succeeds. */
  const [introMuted, setIntroMuted] = useState(true);
  const introActiveRef = useRef(false);
  introActiveRef.current = introActive;
  const introCoverRef = useRef(false);
  introCoverRef.current = introCover;
  const introLeavingRef = useRef(false);
  introLeavingRef.current = introLeaving;
  const introVideoElRef = useRef<HTMLVideoElement | null>(null);
  const introFreezeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const introFadeTimerRef = useRef<number | null>(null);
  /** Lab skipToPlay: already past intro — keep in sync with handStartIntroResolved. */
  const handStartIntroDoneRef = useRef(skipToPlay);
  /** True when 3-2-1 already played over the hand-start theme intro. */
  const handStartCountdownOverIntroRef = useRef(false);
  /** One 3-2-1 per hand — later cards skip straight to play after the top bar. */
  const handCountdownDoneRef = useRef(skipToPlay);
  /**
   * Resume after Save & Exit mid win-reveal: don't arm intro/countdown on the
   * finished card under the restored overlay. Clear once selectedCardId moves on.
   */
  const deferIntroForPendingResultRef = useRef(false);
  const pendingResultCardIdRef = useRef<string | null>(null);
  /** Keeps match locked until that over-intro countdown finishes. */
  const [handStartCountdownPending, setHandStartCountdownPending] =
    useState(false);
  const themeIntroByKeyRef = useRef<Map<string, string>>(new Map());
  /** Lab skipToPlay never fetches themes — ready immediately. */
  const [themeIntrosReady, setThemeIntrosReady] = useState(() => skipToPlay);
  /** True once we've decided whether to show a hand-start intro (or skipped it). */
  const [handStartIntroResolved, setHandStartIntroResolved] = useState(
    () => skipToPlay,
  );
  /**
   * Don't unlock the scratch bar until the card clips have a frame.
   * Avoids the black stage that shows if the bar appears while Safari is still
   * attaching decoders after the theme intro.
   * Lab skipToPlay can show chrome immediately — video readiness still gates play.
   */
  const [gameVideosReady, setGameVideosReady] = useState(() => skipToPlay);
  /**
   * Cold refresh has no audio gesture — wait for Tap to play so theme-intro
   * autoplay + game-clip play() land inside a user gesture (otherwise the
   * stage stays black). Play Game / Play / Continue already unlocked → true.
   */
  const [entryReady, setEntryReady] = useState(() => {
    if (typeof window === "undefined") return false;
    // Lab opens straight into play — no Tap-to-play gate.
    if (skipToPlay) return true;
    if (!loadSoundEnabled()) return true;
    return isCountdownSoundUnlocked();
  });
  const entryReadyRef = useRef(entryReady);
  entryReadyRef.current = entryReady;
  const [sessionSymbols, setSessionSymbols] = useState(buildSessionSymbols);
  const [revealedSymbols, setRevealedSymbols] = useState(0);
  const onRevealedSymbolsChangeRef = useRef(onRevealedSymbolsChange);
  onRevealedSymbolsChangeRef.current = onRevealedSymbolsChange;
  const publishRevealedSymbols = useCallback((count: number) => {
    setRevealedSymbols(count);
    onRevealedSymbolsChangeRef.current?.(count);
  }, []);
  const [frameDiscoveryBatches, setFrameDiscoveryBatches] = useState<
    SymbolDiscoveryBatch[]
  >([]);
  const frameDiscoveryKeyRef = useRef(0);
  const [bodyRevealed, setBodyRevealed] = useState<boolean[]>(() =>
    Array.from({ length: SYMBOL_SLOT_COUNT }, () => false),
  );
  const [bodyFindHits, setBodyFindHits] = useState<boolean[]>(() =>
    Array.from({ length: SYMBOL_SLOT_COUNT }, () => false),
  );
  const bodyFindHitsRef = useRef(bodyFindHits);
  bodyFindHitsRef.current = bodyFindHits;
  const [litTopSlots, setLitTopSlots] = useState<boolean[]>(() =>
    Array.from({ length: TOP_SYMBOL_COUNT }, () => false),
  );
  const [litSymbolSlots, setLitSymbolSlots] = useState<boolean[]>(() =>
    Array.from({ length: SYMBOL_SLOT_COUNT }, () => false),
  );
  const claimedTopSlotsRef = useRef<boolean[]>(
    Array.from({ length: TOP_SYMBOL_COUNT }, () => false),
  );
  const topBarSlotElsRef = useRef<(HTMLDivElement | null)[]>(
    Array.from({ length: TOP_SYMBOL_COUNT }, () => null),
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(18.8);
  const [isPaused, setIsPaused] = useState(false);
  const progressRef = useRef(progress);
  const claimedRef = useRef(claimed);
  const gameResultRef = useRef<GameResult | null>(gameResult);
  gameResultRef.current = gameResult;
  const gameResultPendingRef = useRef<GameResult | null>(null);
  const gameResultTimerRef = useRef<number | null>(null);
  const gameResultLeaveTimerRef = useRef<number | null>(null);
  const introDockTimerRef = useRef<number | null>(null);
  const topSymbolsRef = useRef(topSymbols);
  topSymbolsRef.current = topSymbols;
  const topBarPhaseRef = useRef(topBarPhase);
  topBarPhaseRef.current = topBarPhase;
  const introGateActiveRef = useRef(introGateActive);
  introGateActiveRef.current = introGateActive;
  const showIntroCountdownRef = useRef(showIntroCountdown);
  showIntroCountdownRef.current = showIntroCountdown;
  const sessionSymbolsRef = useRef(sessionSymbols);
  sessionSymbolsRef.current = sessionSymbols;
  const revealedSymbolsRef = useRef(revealedSymbols);
  revealedSymbolsRef.current = revealedSymbols;
  const uiStateRef = useRef({
    currentTime,
    duration,
    isPaused,
    lastUpdatedAt: 0,
  });
  const [scratchZoom, setScratchZoom] = useState<ScratchZoomSettings>(
    loadScratchZoomSettings,
  );
  const scratchZoomRef = useRef(scratchZoom);
  scratchZoomRef.current = scratchZoom;
  const [autoScratch, setAutoScratch] = useState<AutoScratchSettings>(
    loadAutoScratchSettings,
  );
  const autoScratchRef = useRef(autoScratch);
  autoScratchRef.current = autoScratch;
  /** Auto-clear garment after all body symbols found — not the settings toggle. */
  const finishAutoActiveRef = useRef(false);
  const [cursorFx, setCursorFx] =
    useState<CursorFxSettings>(loadCursorFxSettings);
  const cursorFxRef = useRef(cursorFx);
  cursorFxRef.current = cursorFx;
  /** Live progress for celebrate milestones (independent of throttled React progress). */
  const celebrateProgressRef = useRef(0);
  /** Ensures onFirstProgressMilestone runs only once per mount. */
  const firstProgressMilestoneFiredRef = useRef(false);
  const celebrateUntilRef = useRef(0);
  const celebrateTimerRef = useRef<number | null>(null);
  const [cursorFxCelebrate, setCursorFxCelebrate] = useState(false);
  const [cursorFxBurstNonce, setCursorFxBurstNonce] = useState(0);
  /** Display-only coin awards from 10% scratch milestones (not wallet). */
  const [sparkleDelta, setSparkleDelta] = useState(0);
  /** Bumps StageCoinCount scale-pop on each crossedProgressMilestone. */
  const [coinPopNonce, setCoinPopNonce] = useState(0);
  /** Bottom coin badge visibility — idle-hides after ~2s without scrub. */
  const [coinBadgeShown, setCoinBadgeShown] = useState(true);
  const [coinBadgeLeaving, setCoinBadgeLeaving] = useState(false);
  /** Remount shell so enter-bl replays when re-showing from hidden. */
  const [coinBadgeEnterKey, setCoinBadgeEnterKey] = useState(0);
  const coinBadgeShownRef = useRef(coinBadgeShown);
  const coinBadgeLeavingRef = useRef(coinBadgeLeaving);
  const isScratchingRef = useRef(false);
  const coinBadgeIdleTimerRef = useRef<number | null>(null);
  coinBadgeShownRef.current = coinBadgeShown;
  coinBadgeLeavingRef.current = coinBadgeLeaving;
  /** Bumped each rAF — fabric/symbol GPU probes run at most once per frame. */
  const probeFrameIdRef = useRef(0);
  const fabricAlphaCacheRef = useRef(createFabricAlphaCache());
  const symbolScratchProbeCacheRef = useRef(
    createSymbolScratchProbeCache(SYMBOL_SLOT_COUNT),
  );
  /** Live progress is in progressRef; React state publishes ≤1 / UI interval. */
  const progressUiClockRef = useRef(createThrottledUiClock());
  const publishedProgressRef = useRef(0);
  const cursorOnMeshRef = useRef(false);
  const [cursorFxParticleTypes, setCursorFxParticleTypes] = useState<
    ParticleType[]
  >([]);
  const [cursorFxPerf, setCursorFxPerf] = useState({
    active: 0,
    peak: 0,
    avgFrameMs: 0,
  });
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const autoPathRef = useRef<Vec2[]>([]);
  const autoPathIndexRef = useRef(0);
  const autoPathProgressRef = useRef(0);
  const applyScratchAtUvRef = useRef<
    (u: number, v: number, radius: number, worldPoint?: Vec2 | null) => void
  >(() => undefined);
  const addScratchRef = useRef<(clientX: number, clientY: number) => void>(
    () => undefined,
  );
  const tryResolveGameRef = useRef<() => void>(() => undefined);
  const resetScratchRef = useRef<() => void>(() => undefined);
  const symbolAudioRef = useRef<SymbolAudioState>({ ctx: null });

  /** Ref holds live progress; React `progress` publishes ≤1 / UI interval (flush on stroke end). */
  function publishProgressUi(force = false) {
    const next = progressRef.current;
    if (!force && next === publishedProgressRef.current) return;

    if (
      !shouldPublishThrottledUi(
        progressUiClockRef.current,
        performance.now(),
        UI_STATE_UPDATE_INTERVAL_MS,
        force,
      )
    ) {
      return;
    }

    publishedProgressRef.current = next;
    setProgress(next);
  }

  function publishCursorOnMesh(onMesh: boolean) {
    cursorOnMeshRef.current = onMesh;
    setCursorOnMesh((prev) => (prev === onMesh ? prev : onMesh));
  }

  function endScratchStroke() {
    const pending = takePendingScratchMove(scratchInputCoalesceRef.current);
    if (pending) addScratchRef.current(pending.x, pending.y);
    drawingRef.current = false;
    isScratchingRef.current = false;
    setIsScratching(false);
    publishProgressUi(true);
    publishCursorOnMesh(false);
    lastScratchWorldRef.current = null;
    // Stroke ended — start 2s idle hide if badge is visible.
    scheduleCoinBadgeIdleHide();
  }

  function clearCelebrateTimer() {
    if (celebrateTimerRef.current !== null) {
      window.clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = null;
    }
  }

  function clearCoinBadgeIdleTimer() {
    if (coinBadgeIdleTimerRef.current !== null) {
      window.clearTimeout(coinBadgeIdleTimerRef.current);
      coinBadgeIdleTimerRef.current = null;
    }
  }

  function showCoinBadge() {
    clearCoinBadgeIdleTimer();
    const wasShown = coinBadgeShownRef.current;
    const wasLeaving = coinBadgeLeavingRef.current;
    if (!wasShown || wasLeaving) {
      setCoinBadgeEnterKey((k) => k + 1);
    }
    // Sync refs immediately so same-tick callers (e.g. milestone microtask) see the updated state.
    coinBadgeLeavingRef.current = false;
    coinBadgeShownRef.current = true;
    setCoinBadgeLeaving(false);
    setCoinBadgeShown(true);
  }

  function beginCoinBadgeIdleLeave() {
    if (!coinBadgeShownRef.current || coinBadgeLeavingRef.current) return;
    if (isScratchingRef.current) return;

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced) {
      setCoinBadgeShown(false);
      setCoinBadgeLeaving(false);
      return;
    }
    setCoinBadgeLeaving(true);
  }

  function scheduleCoinBadgeIdleHide() {
    clearCoinBadgeIdleTimer();
    if (!coinBadgeShownRef.current || coinBadgeLeavingRef.current) return;
    coinBadgeIdleTimerRef.current = window.setTimeout(() => {
      coinBadgeIdleTimerRef.current = null;
      if (isScratchingRef.current) return;
      beginCoinBadgeIdleLeave();
    }, COIN_BADGE_IDLE_HIDE_MS);
  }

  function onCoinBadgeLeaveEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!coinBadgeLeavingRef.current) return;
    const name = event.animationName || "";
    if (name && !name.includes("pack-progress-leave-bl")) return;
    setCoinBadgeShown(false);
    setCoinBadgeLeaving(false);
  }

  /** 10% progress beat: award coins always; arm fairy-dust when FX allows. */
  function maybeCelebrateScratchProgress(nextProgress: number) {
    const crossed = crossedProgressMilestone(
      celebrateProgressRef.current,
      nextProgress,
    );
    celebrateProgressRef.current = nextProgress;
    if (crossed == null) return;

    if (
      onFirstProgressMilestone &&
      !firstProgressMilestoneFiredRef.current
    ) {
      firstProgressMilestoneFiredRef.current = true;
      onFirstProgressMilestone();
    }

    // Defer badge work so the dust burst paints this frame first.
    const award = rollSparkleCoin();
    queueMicrotask(() => {
      showCoinBadge();
      setSparkleDelta((d) => d + award);
      setCoinPopNonce((n) => n + 1);
      // Milestone counts as activity — restart idle hide clock.
      huntHintActivityAtRef.current = performance.now();
      scheduleCoinBadgeIdleHide();
    });

    let reducedMotion = false;
    try {
      reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reducedMotion = false;
    }
    if (!cursorFxRef.current.fairyDust || reducedMotion) return;

    celebrateUntilRef.current = performance.now() + CURSOR_FX_CELEBRATE_MS;
    setCursorFxCelebrate(true);
    setCursorFxBurstNonce((n) => n + 1);
    clearCelebrateTimer();
    celebrateTimerRef.current = window.setTimeout(() => {
      celebrateTimerRef.current = null;
      if (performance.now() >= celebrateUntilRef.current) {
        setCursorFxCelebrate(false);
      }
    }, CURSOR_FX_CELEBRATE_MS + 40);
  }
  // Phones hide the side panel, so the scratch-zoom config lives behind a gear
  // button that opens this sheet.
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [desktopSettingsTab, setDesktopSettingsTab] =
    useState<DesktopSettingsTab>("scratch-zoom");
  const [glError, setGlError] = useState<string | null>(null);

  function clearGameResultTimer() {
    if (gameResultTimerRef.current !== null) {
      window.clearTimeout(gameResultTimerRef.current);
      gameResultTimerRef.current = null;
    }
  }

  function clearIntroDockTimer() {
    if (introDockTimerRef.current !== null) {
      window.clearTimeout(introDockTimerRef.current);
      introDockTimerRef.current = null;
    }
  }

  function clearIntroFadeTimer() {
    if (introFadeTimerRef.current !== null) {
      window.clearTimeout(introFadeTimerRef.current);
      introFadeTimerRef.current = null;
    }
  }

  function captureIntroFreezeFrame(): boolean {
    const intro = introVideoElRef.current;
    const freeze = introFreezeCanvasRef.current;
    if (!intro || !freeze) return false;
    if (intro.videoWidth < 2 || intro.videoHeight < 2) return false;
    freeze.width = intro.videoWidth;
    freeze.height = intro.videoHeight;
    const ctx = freeze.getContext("2d");
    if (!ctx) return false;
    try {
      ctx.drawImage(intro, 0, 0);
      return true;
    } catch {
      return false;
    }
  }

  function finishIntroCover() {
    clearIntroFadeTimer();
    const intro = introVideoElRef.current;
    if (intro) releaseMediaElement(intro);
    const freeze = introFreezeCanvasRef.current;
    if (freeze) {
      freeze.width = 0;
      freeze.height = 0;
    }
    setIntroLeaving(false);
    introLeavingRef.current = false;
    setIntroCover(false);
    introCoverRef.current = false;
    setIntroVideoUrl("");
    setIntroMuted(true);
  }

  function isBodyScratchLocked() {
    // Lab opens in docked hunt play — never gate on theme intro / fetchThemes.
    if (skipToPlay) return false;
    if (!entryReadyRef.current) return true;
    if (introActiveRef.current || introCoverRef.current) return true;
    // Themes still loading / intro not armed yet for this visit.
    if (
      (gameMode || Boolean(activeModelId)) &&
      !handStartIntroDoneRef.current
    ) {
      return true;
    }
    return (
      useBodySymbolsRef.current &&
      (topBarPhaseRef.current === "center" || introGateActiveRef.current)
    );
  }

  function onMatchEntryTap() {
    unlockCountdownSound();
    handStartIntroDoneRef.current = false;
    handCountdownDoneRef.current = false;
    // Warm symbol lottie HTTP cache before hunt workers spin up (Phase 7).
    void preloadLottieUrls(SYMBOL_TYPES.map((entry) => entry.src));
    // Flush so the intro <video> mounts inside this user gesture — async
    // effect play() is often aborted (readyState 0 / background-media pause).
    flushSync(() => {
      setEntryReady(true);
      if (!gameMode && card && themeIntrosReady) {
        armStartIntro(themeKeyForCard(card));
      }
    });
    const video = introVideoElRef.current;
    if (video && introActiveRef.current) {
      void playThemeIntro(video, soundEnabled).then((result) => {
        if (!introActiveRef.current) return;
        if (!result.playing) return;
        setIntroMuted(result.muted);
      });
    }
  }

  function scheduleIntroCountdown() {
    clearIntroDockTimer();
    introDockTimerRef.current = window.setTimeout(() => {
      introDockTimerRef.current = null;
      setShowIntroCountdown(true);
      showIntroCountdownRef.current = true;
    }, TOP_BAR_DOCK_MS);
  }

  function parkForegroundDecoder() {
    if (fgParkedRef.current) return;
    const foregroundVideo = foregroundVideoRef.current;
    if (!foregroundVideo) return;
    fgParkedRef.current = true;
    try {
      foregroundVideo.pause();
    } catch {
      // ignore
    }
    glRendererRef.current?.detachVideoFrames(foregroundVideo);
  }

  function resumeForegroundDecoder() {
    if (!fgParkedRef.current) return;
    fgParkedRef.current = false;
    kickGameVideos();
  }

  function kickGameVideos() {
    if (uiStateRef.current.isPaused) return;
    if (cardTransitionActiveRef.current && !cardTransitionHandoffRef.current) return;
    const bottomVideo = bottomVideoRef.current;
    const foregroundVideo = foregroundVideoRef.current;
    if (!bottomVideo || !foregroundVideo) return;
    // Don't seek here — currentTime writes flash a black frame on Safari/Chrome.
    const plays = fgParkedRef.current
      ? [bottomVideo.play()]
      : [bottomVideo.play(), foregroundVideo.play()];
    void Promise.all(plays).catch(() => undefined);
  }

  function dismissThemeIntro(options?: { immediate?: boolean }) {
    if (!introActiveRef.current && !introCoverRef.current) return;
    if (introLeavingRef.current && !options?.immediate) return;

    const intro = introVideoElRef.current;
    if (intro) {
      try {
        intro.pause();
      } catch {
        // ignore
      }
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const captured = !options?.immediate && captureIntroFreezeFrame();

    // Free the intro decoder before attaching the game pair (Safari).
    if (intro) releaseMediaElement(intro);
    setIntroActive(false);
    introActiveRef.current = false;
    setIntroVideoUrl("");

    if (options?.immediate || reduceMotion || !captured) {
      finishIntroCover();
      requestAnimationFrame(() => kickGameVideos());
      return;
    }

    // Hold the frozen last frame until the game stage has a decoded frame, then
    // crossfade — avoids the hard cut to black while Safari attaches decoders.
    setIntroCover(true);
    introCoverRef.current = true;
    setIntroLeaving(false);
    introLeavingRef.current = false;
    requestAnimationFrame(() => kickGameVideos());
  }

  function themeKeyForCard(entry: Card): string {
    const fromId = entry.theme_id?.trim();
    if (fromId) return fromId;
    return inferThemeFromLabel(entry.label)?.trim() || "";
  }

  function armStartIntro(themeKey: string) {
    if (handStartIntroDoneRef.current) return;
    handStartIntroDoneRef.current = true;
    clearIntroDockTimer();
    clearIntroFadeTimer();
    setShowIntroCountdown(false);
    showIntroCountdownRef.current = false;
    setHandStartCountdownPending(false);
    handStartCountdownOverIntroRef.current = false;
    setIntroLeaving(false);
    introLeavingRef.current = false;

    // Lab: jump straight to hunt play with the match bar already docked.
    if (skipToPlay) {
      setIntroVideoUrl("");
      setIntroActive(false);
      introActiveRef.current = false;
      setIntroCover(false);
      introCoverRef.current = false;
      setHandStartIntroResolved(true);
      handCountdownDoneRef.current = true;
      setIntroGateActive(false);
      introGateActiveRef.current = false;
      setTopBarPhase("docked");
      topBarPhaseRef.current = "docked";
      setGameVideosReady(false);
      requestAnimationFrame(() => kickGameVideos());
      return;
    }

    const url = themeKey
      ? (themeIntroByKeyRef.current.get(themeKey.toLowerCase()) ?? "")
      : "";
    // Always park game clips until intro/countdown finish — playlist used to
    // start with gameVideosReady=true and immediately dissolve the cover.
    setGameVideosReady(false);
    if (!url) {
      // No theme clip — still run 3-2-1 so product play gets a countdown.
      setIntroVideoUrl("");
      setIntroActive(false);
      introActiveRef.current = false;
      setIntroCover(false);
      introCoverRef.current = false;
      setHandStartIntroResolved(true);
      handStartCountdownOverIntroRef.current = true;
      setHandStartCountdownPending(true);
      setIntroGateActive(true);
      introGateActiveRef.current = true;
      setShowIntroCountdown(true);
      showIntroCountdownRef.current = true;
      return;
    }
    setIntroVideoUrl(url);
    setIntroActive(true);
    introActiveRef.current = true;
    setIntroCover(true);
    introCoverRef.current = true;
    setHandStartIntroResolved(true);
    // 3-2-1 plays on top of the theme intro (once for this visit).
    handStartCountdownOverIntroRef.current = true;
    setHandStartCountdownPending(true);
    setIntroGateActive(true);
    introGateActiveRef.current = true;
    setShowIntroCountdown(true);
    showIntroCountdownRef.current = true;
  }

  function armHandStartIntro(cardId: string, session: GameSession) {
    const themeLabel = themeForMotionCard(session, cardId)?.trim() ?? "";
    armStartIntro(themeLabel);
  }

  function resetGameOutcome() {
    clearGameResultTimer();
    if (gameResultLeaveTimerRef.current !== null) {
      window.clearTimeout(gameResultLeaveTimerRef.current);
      gameResultLeaveTimerRef.current = null;
    }
    gameResultPendingRef.current = null;
    gameResultRef.current = null;
    matchOutcomeRef.current = null;
    setGameResult(null);
    setGameResultLeaving(false);
    setMatchOutcome(null);
  }

  function resetMatchRound() {
    clearIntroDockTimer();
    // New card / round: bring cards-left back until the first scratch touch.
    setPackProgressShown(true);
    setPackProgressLeaving(false);
    setTopSymbols(buildTopSymbols());
    if (skipToPlay) {
      // Lab stays in docked hunt UI across card resets.
      setTopBarPhase("docked");
      topBarPhaseRef.current = "docked";
      setIntroGateActive(false);
      introGateActiveRef.current = false;
      setShowIntroCountdown(false);
      showIntroCountdownRef.current = false;
      handStartIntroDoneRef.current = true;
      handCountdownDoneRef.current = true;
    } else {
      setTopBarPhase("center");
      topBarPhaseRef.current = "center";
      // Card-load effect runs after armHandStartIntro in the same commit. Don't
      // wipe a hand-start 3-2-1 that was just armed (or the over-intro flag stays
      // set and the post-dock countdown is skipped forever).
      const preserveHandStartCountdown =
        handStartCountdownOverIntroRef.current || handStartCountdownPending;
      if (!preserveHandStartCountdown) {
        setIntroGateActive(false);
        introGateActiveRef.current = false;
        setShowIntroCountdown(false);
        showIntroCountdownRef.current = false;
      }
    }
    setTopBarRound((n) => n + 1);
    setSessionSymbols(buildBodySymbols());
    setMatchOutcome(null);
  }

  function unlockPlayAfterDock() {
    clearIntroDockTimer();
    const dockMs = handCountdownDoneRef.current
      ? TOP_BAR_DOCK_NEXT_CARD_MS
      : TOP_BAR_DOCK_MS;
    introDockTimerRef.current = window.setTimeout(() => {
      introDockTimerRef.current = null;
      setIntroGateActive(false);
      introGateActiveRef.current = false;
    }, dockMs);
  }

  function clearLabDockPreviewTimer() {
    if (labDockPreviewTimerRef.current !== null) {
      window.clearTimeout(labDockPreviewTimerRef.current);
      labDockPreviewTimerRef.current = null;
    }
  }

  /** /game-ui: center foil bar with scratch-to-reveal icons. */
  function labShowFoilScratchBar() {
    if (!skipToPlay) return;
    clearLabDockPreviewTimer();
    clearIntroDockTimer();
    setShowIntroCountdown(false);
    showIntroCountdownRef.current = false;
    setIntroGateActive(false);
    introGateActiveRef.current = false;
    setLabTopBarForceRevealed(false);
    setTopBarPhase("center");
    topBarPhaseRef.current = "center";
    setTopBarRound((n) => n + 1);
  }

  /**
   * /game-ui: center → top dock fly (translate + scale, no fade).
   * Park fully at center first so the fly starts at mid-screen, not already up.
   */
  function labPlayDockToTop() {
    if (!skipToPlay) return;
    clearLabDockPreviewTimer();
    clearIntroDockTimer();
    setShowIntroCountdown(false);
    showIntroCountdownRef.current = false;
    setIntroGateActive(false);
    introGateActiveRef.current = false;
    setLabTopBarForceRevealed(true);
    setTopBarPhase("center");
    topBarPhaseRef.current = "center";
    // Hold center long enough for layout + icons before arming the fly.
    labDockPreviewTimerRef.current = window.setTimeout(() => {
      labDockPreviewTimerRef.current = null;
      setTopBarPhase("docked");
      topBarPhaseRef.current = "docked";
    }, 280);
  }

  /** /game-ui: back to normal lab hunt chrome (docked + force-revealed). */
  function labResetTopBarHunt() {
    if (!skipToPlay) return;
    clearLabDockPreviewTimer();
    clearIntroDockTimer();
    setShowIntroCountdown(false);
    showIntroCountdownRef.current = false;
    setIntroGateActive(false);
    introGateActiveRef.current = false;
    setLabTopBarForceRevealed(true);
    setTopBarPhase("docked");
    topBarPhaseRef.current = "docked";
    setTopBarRound((n) => n + 1);
  }

  function onTopBarAllRevealed() {
    setTopBarPhase("docked");
    topBarPhaseRef.current = "docked";
    // Lab foil sequence: land docked with icons locked in; no countdown gate.
    if (skipToPlay) {
      setLabTopBarForceRevealed(true);
      setIntroGateActive(false);
      introGateActiveRef.current = false;
      clearIntroDockTimer();
      return;
    }
    setIntroGateActive(true);
    introGateActiveRef.current = true;
    clearIntroDockTimer();
    // Later cards in the hand: no 3-2-1, just open play after the bar docks.
    if (handCountdownDoneRef.current) {
      unlockPlayAfterDock();
      return;
    }
    // Already ran / still running 3-2-1 over the theme intro — no second copy.
    if (handStartCountdownOverIntroRef.current) {
      handStartCountdownOverIntroRef.current = false;
      if (showIntroCountdownRef.current) {
        // Still playing; unlock when InitialCountdown completes.
        return;
      }
      // Armed for intro but not visible (e.g. wiped by a race) — play it now.
      if (handStartCountdownPending) {
        scheduleIntroCountdown();
        return;
      }
      handCountdownDoneRef.current = true;
      unlockPlayAfterDock();
      return;
    }
    // First card, no over-intro path — one countdown for the whole hand.
    setShowIntroCountdown(false);
    showIntroCountdownRef.current = false;
    scheduleIntroCountdown();
  }

  function onIntroCountdownComplete() {
    handCountdownDoneRef.current = true;
    setShowIntroCountdown(false);
    showIntroCountdownRef.current = false;
    setIntroGateActive(false);
    introGateActiveRef.current = false;
    setHandStartCountdownPending(false);
    // Countdown often ends before the theme intro — if the intro already
    // finished (or never painted), make sure the stage clips are running.
    if (!introActiveRef.current) kickGameVideos();
  }

  useEffect(
    () => () => {
      clearGameResultTimer();
      clearIntroDockTimer();
      clearIntroFadeTimer();
    },
    [],
  );

  useEffect(() => {
    // Lab /game-ui: local cards only — never wait on fetchThemes or reset
    // intro-done (that left isBodyScratchLocked true until the network returned).
    if (skipToPlay) {
      handStartIntroDoneRef.current = true;
      handCountdownDoneRef.current = true;
      setHandStartIntroResolved(true);
      themeIntroByKeyRef.current = new Map();
      setThemeIntrosReady(true);
      return;
    }
    // Product shell opens /game?model&card without ?game=1 — still load theme
    // intros so the clip + 3-2-1 can arm. Hub game-mode uses the same map.
    if (!gameMode && !activeModelId) {
      setThemeIntrosReady(false);
      themeIntroByKeyRef.current = new Map();
      handStartIntroDoneRef.current = false;
      handCountdownDoneRef.current = false;
      setHandStartIntroResolved(true);
      return;
    }
    handStartIntroDoneRef.current = false;
    handCountdownDoneRef.current = false;
    setHandStartIntroResolved(false);
    setThemeIntrosReady(false);
    let cancelled = false;
    void fetchThemes()
      .then((themes) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const theme of themes) {
          const url = theme.intro?.trim();
          if (!url) continue;
          map.set(theme.id.toLowerCase(), url);
          map.set(theme.label.toLowerCase(), url);
        }
        themeIntroByKeyRef.current = map;
        setThemeIntrosReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        themeIntroByKeyRef.current = new Map();
        setThemeIntrosReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gameMode, activeModelId, skipToPlay]);

  useEffect(() => {
    if (
      !gameMode ||
      !gameSession ||
      !selectedCardId ||
      !themeIntrosReady ||
      !entryReady
    ) {
      return;
    }
    if (deferIntroForPendingResultRef.current) {
      // Still showing the finished card under a restored win/no-win overlay.
      if (
        pendingResultCardIdRef.current &&
        selectedCardId === pendingResultCardIdRef.current
      ) {
        return;
      }
      // Advanced to the next card — force a fresh visit countdown.
      deferIntroForPendingResultRef.current = false;
      pendingResultCardIdRef.current = null;
      handStartIntroDoneRef.current = false;
      handCountdownDoneRef.current = false;
      handStartCountdownOverIntroRef.current = false;
      setHandStartCountdownPending(false);
      setShowIntroCountdown(false);
      showIntroCountdownRef.current = false;
      setHandStartIntroResolved(false);
    }
    armHandStartIntro(selectedCardId, gameSession);
  }, [gameMode, gameSession, selectedCardId, themeIntrosReady, entryReady]);

  // Collection / StageNav playlist entry (no deal hub session).
  // Armed from the card-switch effect below so resetMatchRound can't wipe it.
  // (Previously a separate effect ran before card-switch and lost the 3-2-1.)

  // Android/iOS block unmuted autoplay after refresh or async mount — kick
  // playback with a muted fallback so the intro still runs.
  // Game clips stay unloaded while introActive (Safari can't decode three
  // videos). On end we hold the last intro frame as a cover until the game
  // pair has a frame, then crossfade the overlay away.
  useEffect(() => {
    if (!introActive || !introVideoUrl) {
      setIntroMuted(true);
      return;
    }
    let cancelled = false;
    let rafId = 0;

    const kick = () => {
      const video = introVideoElRef.current;
      if (!video) return false;
      void playThemeIntro(video, soundEnabled).then((result) => {
        if (cancelled) return;
        if (!result.playing) {
          // Keep the cover — autoPlay / a later gesture kick may still start.
          // Only the 20s safety timer / onError tears the overlay down.
          return;
        }
        setIntroMuted(result.muted);
      });
      return true;
    };

    if (!kick()) {
      rafId = window.requestAnimationFrame(() => {
        if (!cancelled) kick();
      });
    }

    // Chrome may pause "background" media mid-intro — keep nudging play while
    // the overlay is supposed to be running.
    const onPause = () => {
      if (cancelled || !introActiveRef.current) return;
      const video = introVideoElRef.current;
      if (!video || video.ended) return;
      void video.play().catch(() => undefined);
    };
    const videoEl = introVideoElRef.current;
    videoEl?.addEventListener("pause", onPause);

    // Stuck/black intro (no ended event) — don't cover the stage forever.
    const safetyId = window.setTimeout(() => {
      if (!cancelled && introActiveRef.current) dismissThemeIntro();
    }, 20_000);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(safetyId);
      videoEl?.removeEventListener("pause", onPause);
    };
  }, [introActive, introVideoUrl, soundEnabled]);

  // Once the intro has ended and game clips have a frame, run the reveal.
  useEffect(() => {
    if (!introCover || introActive || introLeaving) return;
    if (!gameVideosReady) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      finishIntroCover();
      return;
    }

    setIntroLeaving(true);
    introLeavingRef.current = true;
    clearIntroFadeTimer();
    introFadeTimerRef.current = window.setTimeout(() => {
      introFadeTimerRef.current = null;
      finishIntroCover();
    }, INTRO_REVEAL_MS);
  }, [introCover, introActive, introLeaving, gameVideosReady]);

  useEffect(() => {
    if (!cardTransition) return;
    const bottomVideo = bottomVideoRef.current;
    const foregroundVideo = foregroundVideoRef.current;
    try {
      bottomVideo?.pause();
      foregroundVideo?.pause();
    } catch {
      // ignore
    }
  }, [cardTransition]);

  useEffect(() => {
    if (!cardTransition || !cardTransitionHandoffRef.current) return;
    if (gameVideosReady) {
      setCardTransitionReady(true);
      const blendId = window.setTimeout(() => {
        finishCardTransition();
      }, 280);
      return () => window.clearTimeout(blendId);
    }
    const safetyId = window.setTimeout(() => {
      finishCardTransition();
    }, 8_000);
    return () => window.clearTimeout(safetyId);
  }, [cardTransition, gameVideosReady]);

  useEffect(() => {
    if (introActive) return;
    kickGameVideos();
  }, [introActive]);

  // / showMesh changes (those are read live via refs).
  useEffect(() => {
    if (!hasPlayableCard || showModelPicker) return;

    let animationId = 0;
    let cancelled = false;
    let renderer: GarmentGLRenderer | null = null;
    const startedAt = performance.now();
    let lastFrameTime = performance.now();

    const ensureRenderer = (): GarmentGLRenderer | null => {
      if (renderer) return renderer;
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        const pixelRatio = resolveGameCanvasPixelRatio({
          coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
          devicePixelRatio:
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        });
        renderer = new GarmentGLRenderer(canvas, CANVAS_WIDTH, CANVAS_HEIGHT, {
          pixelRatio,
        });
        glRendererRef.current = renderer;
        setGlError(null);
        return renderer;
      } catch (error) {
        console.error("WebGL init failed", error);
        setGlError(
          error instanceof Error ? error.message : "WebGL2 not available",
        );
        return null;
      }
    };

    const render = () => {
      try {
        if (cancelled) return;
        const active = ensureRenderer();
        if (!active) return;
        probeFrameIdRef.current += 1;
        // One densified scratch apply per rAF while the finger moves (Phase 7).
        if (drawingRef.current) {
          const pending = takePendingScratchMove(
            scratchInputCoalesceRef.current,
          );
          if (pending) addScratchRef.current(pending.x, pending.y);
        } else {
          clearPendingScratchMove(scratchInputCoalesceRef.current);
        }
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
        lastFrameTime = now;
        const time = (now - startedAt) / 1000;
        const bottomVideo = bottomVideoRef.current;
        const foregroundVideo = foregroundVideoRef.current;
        const trackedMeshNow = trackedMeshRef.current;
        // Sample the mesh on the FOREGROUND clock — the mesh was tracked from the
        // foreground (performer) clip, so this keeps scratch holes glued to the
        // body regardless of any residual drift between the two free-running
        // videos. After claim the FG decoder is parked; fall back to bottom so
        // chest-follow can keep moving with the remaining clip.
        const meshTime = fgParkedRef.current
          ? (bottomVideo?.currentTime ?? time)
          : (foregroundVideo?.currentTime ?? bottomVideo?.currentTime ?? time);
        const trackedSample = trackedMeshNow
          ? sampleTrackedMesh(trackedMeshNow, meshTime)
          : null;
        trackedSampleRef.current = trackedSample;
        const videoTime = bottomVideo?.currentTime ?? time;

        // Subtle chest-follow camera: pan toward keeping the chest anchor at its
        // target framing point, clamped + smoothed. Freeze while the finger is
        // down (Phase 8) so camMoved doesn't force extra GL presents during scratch.
        const camera = cameraRef.current;
        if (
          shouldUpdateChestFollow({ isScratching: drawingRef.current }) &&
          trackedSample
        ) {
          const chest = sampleMeshUvToWorld(
            trackedSample,
            CHEST_ANCHOR_UV.x,
            CHEST_ANCHOR_UV.y,
          );
          const targetPx = CANVAS_WIDTH * CHEST_TARGET_UV.x;
          const targetPy = CANVAS_HEIGHT * CHEST_TARGET_UV.y;
          const shiftX = (targetPx - chest.x) * CHEST_FOLLOW_STRENGTH;
          const shiftY = (targetPy - chest.y) * CHEST_FOLLOW_STRENGTH;
          const targetCamX = clampValue(
            shiftX / (CANVAS_WIDTH / 2),
            -CHEST_CAM_MAX,
            CHEST_CAM_MAX,
          );
          const targetCamY = clampValue(
            -shiftY / (CANVAS_HEIGHT / 2),
            -CHEST_CAM_MAX,
            CHEST_CAM_MAX,
          );
          const dx = targetCamX - camera.x;
          const dy = targetCamY - camera.y;
          if (Math.abs(dx) <= CHEST_CAM_EPS && Math.abs(dy) <= CHEST_CAM_EPS) {
            camera.x = targetCamX;
            camera.y = targetCamY;
          } else {
            const nextX = camera.x + dx * CHEST_SMOOTH;
            const nextY = camera.y + dy * CHEST_SMOOTH;
            camera.x =
              Math.abs(targetCamX - nextX) <= CHEST_CAM_EPS ? targetCamX : nextX;
            camera.y =
              Math.abs(targetCamY - nextY) <= CHEST_CAM_EPS ? targetCamY : nextY;
          }
        }

        const autoSettings = autoScratchRef.current;
        const autoActive =
          finishAutoActiveRef.current || autoSettings.enabled;
        // Never auto-finish while body-symbol hunt is still in progress — otherwise a
        // persisted "enabled" flag (or premature toggle) wipes the dress before the player finds them all.
        const huntComplete =
          !useBodySymbolsRef.current ||
          revealedSymbolsRef.current >= SYMBOL_SLOT_COUNT;
        const autoBudget = resolveAutoScratchBudget({
          coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
        });
        if (
          autoActive &&
          huntComplete &&
          !isBodyScratchLocked() &&
          trackedSample &&
          gameResultPendingRef.current === null
        ) {
          const path = autoPathRef.current;
          if (path.length > 0 && autoPathIndexRef.current < path.length) {
            autoPathProgressRef.current += autoSettings.speed * dt;
            let scratched = 0;
            while (
              autoPathProgressRef.current >= 1 &&
              autoPathIndexRef.current < path.length &&
              scratched < autoBudget.maxPerFrame
            ) {
              autoPathProgressRef.current -= 1;
              const pt = path[autoPathIndexRef.current];
              const worldPos = sampleMeshUvToWorld(trackedSample, pt.x, pt.y);
              applyScratchAtUvRef.current(
                pt.x,
                pt.y,
                AUTO_SCRATCH_RADIUS,
                worldPos,
              );
              autoPathIndexRef.current += 1;
              scratched += 1;
            }
          }

          const pathDone =
            path.length === 0 || autoPathIndexRef.current >= path.length;
          const sampleCount = revealSamplesRef.current.length;
          const garmentComplete = isGarmentFullyRevealed(
            progressRef.current,
            revealedCountRef.current,
            sampleCount,
            true,
          );
          if (!garmentComplete && sampleCount > 0 && pathDone) {
            const samples = revealSamplesRef.current;
            const revealed = revealedRef.current;
            let filled = 0;
            for (
              let i = 0;
              i < samples.length && filled < autoBudget.fillBatch;
              i += 1
            ) {
              if (revealed[i]) continue;
              const pt = samples[i];
              const worldPos = sampleMeshUvToWorld(trackedSample, pt.x, pt.y);
              applyScratchAtUvRef.current(
                pt.x,
                pt.y,
                AUTO_SCRATCH_RADIUS,
                worldPos,
              );
              filled += 1;
            }
          }
        }

        if (
          bottomVideo &&
          foregroundVideo &&
          !fgParkedRef.current &&
          bottomVideo.readyState >= 2 &&
          foregroundVideo.readyState >= 2
        ) {
          syncVideoTime(bottomVideo, foregroundVideo, {
            isScratching: drawingRef.current,
          });
        }

        if (bottomVideo) {
          const now = performance.now();
          const nextDuration =
            bottomVideo.duration || uiStateRef.current.duration;
          const nextPaused = bottomVideo.paused;
          const shouldUpdateUi =
            now - uiStateRef.current.lastUpdatedAt >=
              UI_STATE_UPDATE_INTERVAL_MS ||
            nextPaused !== uiStateRef.current.isPaused ||
            Math.abs(videoTime - uiStateRef.current.currentTime) > 1;

          if (shouldUpdateUi) {
            uiStateRef.current = {
              currentTime: videoTime,
              duration: nextDuration,
              isPaused: nextPaused,
              lastUpdatedAt: now,
            };
            setCurrentTime(videoTime);
            setDuration(nextDuration);
            setIsPaused(nextPaused);
          }
        }

        const sampleCount = revealSamplesRef.current.length;
        const autoMode = autoScratchRef.current.enabled;
        const canClaim =
          !useBodySymbolsRef.current ||
          revealedSymbolsRef.current >= SYMBOL_SLOT_COUNT;
        const hideForeground =
          claimedRef.current ||
          (canClaim &&
            isGarmentFullyRevealed(
              progressRef.current,
              revealedCountRef.current,
              sampleCount,
              autoMode,
            ));
        if (
          hideForeground &&
          !claimedRef.current &&
          !packRevealBlockedRef.current
        ) {
          claimedRef.current = true;
          setClaimed(true);
          tryResolveGameRef.current();
        }
        // Stop FG decode + rVFC once the performer layer is off-screen.
        if (hideForeground) parkForegroundDecoder();

        active.render(
          bottomVideo,
          foregroundVideo,
          trackedSample,
          showMeshRef.current,
          camera,
          hideForeground,
          chromaKeyRef.current,
          PRESENT_ZOOM,
          // Phase 8: half-rate underlay only while scratching on coarse pointers.
          shouldHalfRateBottomUploads({
            hideForeground,
            isScratching: drawingRef.current,
            coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
          }),
        );

        // Skip body-marker transforms while the intro countdown covers the stage —
        // markers aren't visible under the overlay, and recomputing 12 DOM styles
        // every frame stacks on top of video decode + WebGL + the countdown Lottie.
        const bodyPoints = trackedMeshNow?.symbolPoints;
        const stage = stageRef.current;
        const canvas = canvasRef.current;
        if (
          shouldUpdateBodyMarkers({ isScratching: drawingRef.current }) &&
          !showIntroCountdownRef.current &&
          bodyPoints &&
          bodyPoints.length === SYMBOL_SLOT_COUNT &&
          trackedSample &&
          stage &&
          canvas
        ) {
          const layout = bodyMarkerLayoutRef.current;
          if (
            layout.framesUntilRefresh <= 0 ||
            !layout.canvasRect ||
            !layout.stageRect
          ) {
            layout.canvasRect = canvas.getBoundingClientRect();
            layout.stageRect = stage.getBoundingClientRect();
            layout.framesUntilRefresh = 8;
          } else {
            layout.framesUntilRefresh -= 1;
          }
          const canvasRect = layout.canvasRect;
          const stageRect = layout.stageRect;
          const remainingSymbols =
            SYMBOL_SLOT_COUNT - revealedSymbolsRef.current;
          const nowMs = performance.now();
          const idleLongEnough =
            !drawingRef.current &&
            nowMs - huntHintActivityAtRef.current >= HINT_IDLE_MS;
          const pulsarEligible =
            useBodySymbolsRef.current &&
            topBarPhaseRef.current === "docked" &&
            !claimedRef.current &&
            !isBodyScratchLocked() &&
            remainingSymbols > 0 &&
            remainingSymbols <= HINT_REMAINING_MAX &&
            idleLongEnough;
          const activePulsarIndex = advanceHuntHintCycle(
            huntHintCycleRef.current,
            {
              now: nowMs,
              revealed: revealedPointsRef.current,
              eligible: pulsarEligible,
              dwellMs: HINT_PULSE_DWELL_MS,
              gapMs: HINT_PULSE_GAP_MS,
            },
          );
          for (let index = 0; index < SYMBOL_SLOT_COUNT; index += 1) {
            const marker = bodyMarkerRefs.current[index];
            const revealed = revealedPointsRef.current[index];
            // Matches leave the body (fly to the top bar) — only misses stay mounted.
            const visible = revealed && !bodyFindHitsRef.current[index];
            if (!marker) continue;
            // Writing an unchanged style value still dirties style for that
            // element. Blindly re-assigning display + transform on all six markers
            // cost ~1440 style recalcs/second even with nothing revealed, so track
            // what was last written. Keyed on the element so a remount (new card,
            // new session symbols) re-applies instead of trusting a stale cache.
            let applied = bodyMarkerStyleRef.current[index];
            if (!applied || applied.el !== marker) {
              applied = { el: marker, transform: "", revealed: null };
              bodyMarkerStyleRef.current[index] = applied;
            }
            if (applied.revealed !== visible) {
              marker.style.display = visible ? "flex" : "none";
              marker.classList.toggle("is-revealed", visible);
              applied.revealed = visible;
            }
            // A hidden marker has no box — positioning it is invisible work.
            if (!visible) continue;
            const world = sampleMeshUvToWorld(
              trackedSample,
              bodyPoints[index].u,
              bodyPoints[index].v,
            );
            const stagePos = worldPointToStageWithRects(
              world,
              canvasRect,
              stageRect,
              camera,
            );
            const transform = `translate(${stagePos.x}px, ${stagePos.y}px)`;
            if (applied.transform !== transform) {
              marker.style.transform = transform;
              applied.transform = transform;
            }
          }

          // One shared pulsar node — never more than one hint on screen.
          const pulsar = huntPulsarRef.current;
          const pulsarApplied = huntPulsarStyleRef.current;
          const showPulsar =
            activePulsarIndex >= 0 &&
            !revealedPointsRef.current[activePulsarIndex];
          if (pulsar) {
            if (showPulsar) {
              const pt = bodyPoints[activePulsarIndex];
              const world = sampleMeshUvToWorld(trackedSample, pt.u, pt.v);
              const stagePos = worldPointToStageWithRects(
                world,
                canvasRect,
                stageRect,
                camera,
              );
              const transform = `translate(${stagePos.x}px, ${stagePos.y}px)`;
              if (
                !pulsarApplied.active ||
                pulsarApplied.index !== activePulsarIndex
              ) {
                pulsar.style.display = "flex";
                pulsar.classList.add("is-active");
                pulsarApplied.active = true;
                pulsarApplied.index = activePulsarIndex;
              }
              if (pulsarApplied.transform !== transform) {
                pulsar.style.transform = transform;
                pulsarApplied.transform = transform;
              }
            } else if (pulsarApplied.active) {
              pulsar.style.display = "none";
              pulsar.classList.remove("is-active");
              pulsarApplied.active = false;
              pulsarApplied.index = -1;
              pulsarApplied.transform = "";
            }
          }
        } else {
          const pulsar = huntPulsarRef.current;
          const pulsarApplied = huntPulsarStyleRef.current;
          if (pulsar && pulsarApplied.active) {
            pulsar.style.display = "none";
            pulsar.classList.remove("is-active");
            pulsarApplied.active = false;
            pulsarApplied.index = -1;
            pulsarApplied.transform = "";
          }
        }
      } catch (error) {
        console.error("Scratch render loop error", error);
      } finally {
        if (!cancelled) animationId = requestAnimationFrame(render);
      }
    };

    animationId = requestAnimationFrame(render);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      // Dispose GL only. Keep the WebGL2 context — StrictMode / card remounts
      // recreate GarmentGLRenderer on the same canvas; losing the context leaves
      // getContext stuck on a dead handle and the stage paints black forever.
      renderer?.dispose({ loseContext: false });
      if (glRendererRef.current === renderer) glRendererRef.current = null;
      renderer = null;
    };
  }, [hasPlayableCard, showModelPicker]);

  useEffect(() => {
    let isCancelled = false;

    // Lab /game-ui: never wait on API/auth. Mount local DEFAULT_CARDS + mesh
    // immediately so phones can preview without a session or media key.
    if (skipToPlay) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("card")?.trim() || "juliana_1";
      const modelFromUrl = params.get("model")?.trim() || "julianaval";
      const labCards = DEFAULT_CARDS.map((entry) =>
        entry.id.startsWith("juliana")
          ? { ...entry, model_id: entry.model_id ?? "julianaval" }
          : entry,
      );
      const labCard =
        labCards.find((entry) => entry.id === fromUrl) ??
        labCards.find((entry) => entry.id === "juliana_1") ??
        labCards[0]!;
      setCards(labCards);
      setModels([
        {
          id: modelFromUrl,
          label: "Juliana",
          avatar: null,
        },
      ]);
      singleCardIdRef.current = labCard.id;
      setPlaylistMode(false);
      setActiveModelId(modelFromUrl);
      setSelectedCardId(labCard.id);
      setSelectedMeshFile(labCard.mesh);
      setCardsReady(true);
      return () => {
        isCancelled = true;
      };
    }

    Promise.all([loadCards(), fetchModels()])
      .then(([loaded, loadedModels]) => {
        if (isCancelled) return;
        setCards(loaded);
        setModels(loadedModels);
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get("card")?.trim() || "";
        let modelFromUrl = params.get("model")?.trim() || "";
        if (fromUrl) {
          const cardModel =
            loaded.find((entry) => entry.id === fromUrl)?.model_id?.trim() ||
            "";
          // Card wins over a stale ?model= so Shine never opens Brazilian.
          if (cardModel) modelFromUrl = cardModel;
        }

        if (isGameModeUrl()) {
          const session = loadGameSession();
          if (session?.phase === "motion") {
            setGameSession(session);
            setCompletedCardIds(session.completedMotionIds);
            completedCardIdsRef.current = session.completedMotionIds;
            const ordered = playlistCardsForGameSession(loaded, session);
            const modelId =
              modelFromUrl ||
              session.modelId ||
              ordered[0]?.model_id?.trim() ||
              "";
            setActiveModelId(modelId);
            if (ordered.length === 0) {
              setSelectedCardId("");
              return;
            }
            const remaining = ordered.filter(
              (entry) => !session.completedMotionIds.includes(entry.id),
            );
            const pending = session.pendingMotionResult;
            const startId = pending?.cardId
              ? pending.cardId
              : fromUrl && remaining.some((entry) => entry.id === fromUrl)
                ? fromUrl
                : (remaining[0]?.id ?? ordered[0]!.id);
            if (pending) {
              // Win/no-win overlay first — arm 3-2-1 only for the next card.
              deferIntroForPendingResultRef.current = true;
              pendingResultCardIdRef.current = pending.cardId;
            }
            setSelectedCardId(startId);
            if (pending) {
              void loadGameCatalog()
                .then((catalog) => {
                  const photos = pending.photoIds
                    .map((id) => catalog.photos.find((photo) => photo.id === id))
                    .filter((photo): photo is PhotoCard => Boolean(photo));
                  setMotionResult({
                    win: pending.prize > 0 && photos.length > 0,
                    photos,
                    current: pending.current,
                    total: pending.total,
                    resultId: `${pending.cardId}:${pending.photoIds.join(",")}:${pending.current}`,
                  });
                })
                .catch(() => {
                  setMotionResult({
                    win: false,
                    photos: [],
                    current: pending.current,
                    total: pending.total,
                    resultId: `pending-error:${pending.cardId}`,
                  });
                });
            }
            return;
          }
        }

        if (!modelFromUrl) {
          setActiveModelId("");
          setSelectedCardId("");
          singleCardIdRef.current = "";
          return;
        }

        const wantPlaylist = params.get("playlist") === "1";
        setPlaylistMode(wantPlaylist);

        if (!wantPlaylist && fromUrl) {
          // Collection Play Game — one card only, then back to collection.
          const one = loaded.find(
            (entry) =>
              entry.id === fromUrl &&
              (entry.model_id === modelFromUrl || !entry.model_id),
          );
          singleCardIdRef.current = one?.id ?? fromUrl;
          setActiveModelId(modelFromUrl);
          setSelectedCardId(one?.id ?? "");
          return;
        }

        singleCardIdRef.current = "";
        const ordered = playlistCardsForModel(loaded, modelFromUrl);
        setActiveModelId(modelFromUrl);
        if (ordered.length === 0) {
          setSelectedCardId("");
          return;
        }
        const startId =
          fromUrl && ordered.some((entry) => entry.id === fromUrl)
            ? fromUrl
            : ordered[0]!.id;
        setSelectedCardId(startId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) setCardsReady(true);
      });
    return () => {
      isCancelled = true;
    };
  }, [skipToPlay]);

  useEffect(() => {
    if (typeof window === "undefined" || !cardsReady) return;
    const url = new URL(window.location.href);
    if (activeModelId) url.searchParams.set("model", activeModelId);
    else url.searchParams.delete("model");
    if (
      selectedCardId &&
      modelCards.some((entry) => entry.id === selectedCardId)
    ) {
      url.searchParams.set("card", selectedCardId);
    } else {
      url.searchParams.delete("card");
    }
    if (gameMode) url.searchParams.set("game", "1");
    else url.searchParams.delete("game");
    if (playlistMode && !gameMode) url.searchParams.set("playlist", "1");
    else url.searchParams.delete("playlist");
    const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [
    activeModelId,
    cardsReady,
    gameMode,
    modelCards,
    playlistMode,
    selectedCardId,
  ]);

  useEffect(() => {
    if (gameMode) return;
    setCompletedCardIds([]);
    completedCardIdsRef.current = [];
  }, [activeModelId, gameMode]);

  useEffect(() => {
    if (!cardsReady) return;
    if (!gameMode && !activeModelId) return;
    if (modelCards.length === 0) {
      if (selectedCardId) setSelectedCardId("");
      return;
    }
    const belongs =
      Boolean(selectedCardId) &&
      modelCards.some((entry) => entry.id === selectedCardId) &&
      !completedCardIds.includes(selectedCardId);
    if (belongs) return;
    setSelectedCardId(remainingCards[0]?.id ?? modelCards[0]?.id ?? "");
  }, [
    activeModelId,
    cardsReady,
    completedCardIds,
    gameMode,
    modelCards,
    remainingCards,
    selectedCardId,
  ]);

  useEffect(() => {
    let isCancelled = false;

    fetch(`${MESH_INDEX_SRC}?v=${meshReloadToken}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isCancelled || !data) return;
        const files = parseMeshIndex(data);
        setMeshFiles(files);
        setSelectedMeshFile(
          (currentFile) =>
            currentFile ||
            (files.includes(DEFAULT_MESH_FILE)
              ? DEFAULT_MESH_FILE
              : files[0]) ||
            "",
        );
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [meshReloadToken]);

  useEffect(() => {
    if (!selectedMeshFile) {
      setTrackedMesh(null);
      return;
    }

    let isCancelled = false;

    fetch(
      `${MESH_DIRECTORY_SRC}/${encodeURIComponent(selectedMeshFile)}?v=${meshReloadToken}`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isCancelled || !data) return;
        setTrackedMesh(parseTrackedMesh(data));
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [meshReloadToken, selectedMeshFile]);

  // Switching cards: load that card's mesh and clear scratches/progress so holes
  // from the previous clip don't carry over onto the new fabric.
  useEffect(() => {
    if (!card) {
      setSelectedMeshFile("");
      return;
    }
    setSelectedMeshFile(card.mesh);
    clearScratchMarks(marksRef.current);
    glRendererRef.current?.clearScratch();
    glRendererRef.current?.clearFlakes();
    if (!cardTransitionActiveRef.current) {
      glRendererRef.current?.resetForeground();
    }
    revealSamplesRef.current = [];
    revealedRef.current = [];
    revealedCountRef.current = 0;
    progressRef.current = 0;
    celebrateProgressRef.current = 0;
    clearCelebrateTimer();
    setCursorFxCelebrate(false);
    setSparkleDelta(0);
    setCoinPopNonce(0);
    clearCoinBadgeIdleTimer();
    setCoinBadgeLeaving(false);
    setCoinBadgeShown(true);
    setCoinBadgeEnterKey((k) => k + 1);
    claimedRef.current = false;
    fgParkedRef.current = false;
    huntHintActivityAtRef.current = performance.now();
    huntHintCycleRef.current = { index: -1, shownAt: 0, phase: "show" };
    resetGameOutcome();
    revealedSymbolsRef.current = 0;
    revealedPointsRef.current = Array.from(
      { length: SYMBOL_SLOT_COUNT },
      () => false,
    );
    autoPathIndexRef.current = 0;
    autoPathProgressRef.current = 0;
    resetMatchRound();
    publishedProgressRef.current = 0;
    publishProgressUi(true);
    setClaimed(false);
    publishRevealedSymbols(0);
    setLitSymbolSlots(
      Array.from({ length: SYMBOL_SLOT_COUNT }, () => false),
    );
    setFrameDiscoveryBatches([]);
    frameDiscoveryKeyRef.current = 0;
    setBodyRevealed(Array.from({ length: SYMBOL_SLOT_COUNT }, () => false));
    setBodyFindHits(Array.from({ length: SYMBOL_SLOT_COUNT }, () => false));
    bodyFindHitsRef.current = Array.from(
      { length: SYMBOL_SLOT_COUNT },
      () => false,
    );
    setLitTopSlots(Array.from({ length: TOP_SYMBOL_COUNT }, () => false));
    claimedTopSlotsRef.current = Array.from(
      { length: TOP_SYMBOL_COUNT },
      () => false,
    );
    setFlyingCoins([]);
    setGameResult(null);
    finishAutoActiveRef.current = false;
    autoScratchRef.current = { ...autoScratchRef.current, enabled: false };
    setAutoScratch((current) => ({ ...current, enabled: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, card?.id, card?.mesh, labRestartToken]);

  // Product play: arm theme intro + 3-2-1 after Tap to play, in an effect that
  // does NOT share a resetMatchRound with the card-switch path (that race was
  // wiping the countdown before the first paint).
  // Lab skipToPlay: arm immediately (themeIntrosReady is sync-true; no network).
  useEffect(() => {
    if (gameMode) return;
    if (!entryReady || !card) return;
    if (!skipToPlay && !themeIntrosReady) return;
    armStartIntro(themeKeyForCard(card));
  }, [gameMode, entryReady, themeIntrosReady, card?.id, skipToPlay]);

  // Rebuild the reveal sample grid whenever the mesh changes, recomputing which
  // samples are already revealed from the current marks (usually empty after a
  // card switch / reset). Keeps the percentage consistent across mesh reloads.
  useEffect(() => {
    const samples = buildRevealSamples(trackedMesh);
    revealSamplesRef.current = samples;
    const revealed = samples.map((p) =>
      scratchMarksSome(
        marksRef.current,
        (m) => Math.hypot((m.u - p.x) / m.radius, (m.v - p.y) / m.radius) <= 1,
      ),
    );
    revealedRef.current = revealed;
    revealedCountRef.current = revealed.reduce((n, r) => n + (r ? 1 : 0), 0);
    const next = samples.length ? revealedCountRef.current / samples.length : 0;
    progressRef.current = next;
    publishedProgressRef.current = next;
    celebrateProgressRef.current = next;
    publishProgressUi(true);
    const hasBodySymbols =
      trackedMesh?.symbolPoints?.length === SYMBOL_SLOT_COUNT;
    const nextSymbolCount = hasBodySymbols
      ? revealedPointsRef.current.filter(Boolean).length
      : revealedSymbolCount(next, autoScratchRef.current.enabled);
    revealedSymbolsRef.current = nextSymbolCount;
    publishRevealedSymbols(nextSymbolCount);
    if (!hasBodySymbols && nextSymbolCount > 0) {
      setLitSymbolSlots(
        Array.from(
          { length: SYMBOL_SLOT_COUNT },
          (_, index) => index < nextSymbolCount,
        ),
      );
    }
    if (hasBodySymbols && nextSymbolCount < SYMBOL_SLOT_COUNT) {
      setAutoScratch((current) =>
        current.enabled ? { ...current, enabled: false } : current,
      );
    }
    const nextClaimed = hasBodySymbols
      ? false
      : isGarmentFullyRevealed(
          next,
          revealedCountRef.current,
          samples.length,
          autoScratchRef.current.enabled,
        );
    claimedRef.current = nextClaimed;
    setClaimed(nextClaimed);
    if (nextClaimed && !packRevealBlockedRef.current) {
      tryResolveGameRef.current();
    }
  }, [trackedMesh]);

  useEffect(() => {
    autoPathRef.current = buildAutoScratchPath(trackedMesh);
    autoPathIndexRef.current = 0;
    autoPathProgressRef.current = 0;
  }, [trackedMesh]);

  useEffect(() => {
    // Stage (and its <video> nodes) only mount after cardsReady. Without this
    // dep, skip-to-play never toggles introActive so the first null-ref run
    // never retries and the stage stays black.
    if (!cardsReady || !card) return;

    const bottomVideo = bottomVideoRef.current;
    const foregroundVideo = foregroundVideoRef.current;
    if (!bottomVideo || !foregroundVideo) return;

    // Theme intro + two game clips = three decoders. Safari/iOS often starves
    // the game pair and leaves a black WebGL stage after 3-2-1. While the
    // intro is up, fully unload the card clips so only the intro decodes.
    if (introActiveRef.current) {
      releaseMediaElement(bottomVideo);
      releaseMediaElement(foregroundVideo);
      glRendererRef.current?.resetForeground();
      setGameVideosReady(false);
      return;
    }

    let cancelled = false;
    fgParkedRef.current = false;
    uiStateRef.current = { ...uiStateRef.current, isPaused: false };
    setIsPaused(false);
    setGameVideosReady(false);

    let kicked = false;
    const kickPlayback = () => {
      if (cancelled || kicked) return;
      // Wait until BOTH videos have at least HAVE_CURRENT_DATA so their first
      // decoded frame is ready. Firing play() on one while the other is still
      // buffering creates a startup offset that the soft-seek must then chase.
      if (bottomVideo.readyState < 2 || foregroundVideo.readyState < 2) return;
      if (bottomVideo.videoWidth < 2 || foregroundVideo.videoWidth < 2) return;
      kicked = true;
      const nextDuration = bottomVideo.duration || uiStateRef.current.duration;
      uiStateRef.current = {
        ...uiStateRef.current,
        duration: nextDuration,
        isPaused: false,
      };
      setDuration(nextDuration);

      const startPair = () => {
        if (cancelled) return;
        void Promise.all([bottomVideo.play(), foregroundVideo.play()])
          .then(() => {
            if (!cancelled) setGameVideosReady(true);
          })
          .catch(() => undefined);
      };

      // Play from the already-decoded first frame. Seeking to 0 after a src
      // attach fires waiting and flashes a black decoder frame.
      startPair();
    };

    // Reuse the same two <video> elements and swap src (no React key remount).
    // Safari releases the previous decoder only when we unload before load.
    void (async () => {
      try {
        await Promise.all([
          loadVideoSrc(bottomVideo, card.bottom),
          loadVideoSrc(foregroundVideo, card.foreground),
        ]);
      } catch {
        if (!cancelled) setGameVideosReady(true);
        return;
      }
      if (cancelled) return;
      bottomVideo.addEventListener("canplay", kickPlayback);
      foregroundVideo.addEventListener("canplay", kickPlayback);
      kickPlayback();
    })();

    // Don't leave game-mode locked on the intro cover forever if decode stalls.
    const readySafetyId = window.setTimeout(() => {
      if (!cancelled) setGameVideosReady(true);
    }, 8_000);

    return () => {
      cancelled = true;
      window.clearTimeout(readySafetyId);
      bottomVideo.removeEventListener("canplay", kickPlayback);
      foregroundVideo.removeEventListener("canplay", kickPlayback);
      try {
        bottomVideo.pause();
        foregroundVideo.pause();
      } catch {
        // ignore
      }
    };
  }, [cardsReady, card?.id, card?.bottom, card?.foreground, introActive]);

  // Mobile browsers (notably iOS Safari) will suspend a second, simultaneously
  // playing <video> after a few seconds to save power — which here drops the
  // foreground below readyState 2 and leaves only the bottom video on screen.
  // This watchdog nudges both clips back to playing whenever they get paused
  // out from under us (and on tab re-focus), as long as the user hasn't paused.
  useEffect(() => {
    const keepPlaying = () => {
      if (uiStateRef.current.isPaused) return;
      // Don't steal the decoder from the theme intro (causes black stage after
      // 3-2-1 on Safari / Android when three <video>s fight).
      if (introActiveRef.current) return;
      if (cardTransitionActiveRef.current) return;
      const bottomVideo = bottomVideoRef.current;
      const foregroundVideo = foregroundVideoRef.current;
      if (bottomVideo?.paused) void bottomVideo.play().catch(() => undefined);
      // After claim FG is intentionally parked — do not revive its decoder.
      if (!fgParkedRef.current && foregroundVideo?.paused)
        void foregroundVideo.play().catch(() => undefined);
    };

    const intervalId = window.setInterval(keepPlaying, 1000);
    document.addEventListener("visibilitychange", keepPlaying);
    window.addEventListener("focus", keepPlaying);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", keepPlaying);
      window.removeEventListener("focus", keepPlaying);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SCRATCH_ZOOM_STORAGE_KEY, JSON.stringify(scratchZoom));
  }, [scratchZoom]);

  useEffect(() => {
    localStorage.setItem(AUTO_SCRATCH_STORAGE_KEY, JSON.stringify(autoScratch));
  }, [autoScratch]);

  useEffect(() => {
    localStorage.setItem(CURSOR_FX_STORAGE_KEY, JSON.stringify(cursorFx));
  }, [cursorFx]);

  useEffect(() => {
    if (!cursorFx.fairyDust) return;
    const id = window.setInterval(() => {
      const active = fairyDustPerf.active;
      const peak = fairyDustPerf.peak;
      const avgFrameMs = Math.round(fairyDustPerf.avgFrameMs * 100) / 100;
      setCursorFxPerf((current) =>
        current.active === active &&
        current.peak === peak &&
        current.avgFrameMs === avgFrameMs
          ? current
          : { active, peak, avgFrameMs },
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [cursorFx.fairyDust]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await Promise.all(
          CURSOR_FX_LOTTIE_PRESETS.map(async (preset, i) => {
            const result = await loadLottieUrlSource(preset.url, preset.name);
            return {
              id: `cursor-fx-lottie-${i}`,
              kind: "lottie" as const,
              name: result.name,
              source: result.source,
            };
          }),
        );
        if (!cancelled) setCursorFxParticleTypes(loaded);
      } catch {
        if (!cancelled) setCursorFxParticleTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The pause overlay and profile settings write the same store, so follow it
  // rather than owning the flag. Notifications are synchronous, which keeps the
  // unlock below inside the click that flipped the switch — Safari requires
  // AudioContext work to happen in a user gesture.
  useEffect(
    () =>
      subscribeGameAudioPrefs(() => {
        const next = getGameAudioPrefs().soundEffect;
        if (next) {
          ensureSymbolAudio(symbolAudioRef.current);
          unlockCountdownSound();
        }
        setSoundEnabled(next);
      }),
    [],
  );

  function syncScratchZoomTransition(
    canvas: HTMLCanvasElement,
    settings = scratchZoomRef.current,
  ) {
    canvas.style.setProperty(
      "--scratch-zoom-duration",
      `${settings.durationMs}ms`,
    );
    canvas.style.setProperty(
      "--scratch-zoom-easing",
      scratchZoomEasing(settings.bounce),
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) syncScratchZoomTransition(canvas);
  }, [scratchZoom]);

  function updateScratchZoom(patch: Partial<ScratchZoomSettings>) {
    setScratchZoom((current) => ({ ...current, ...patch }));
  }

  function updateAutoScratch(patch: Partial<AutoScratchSettings>) {
    if (
      patch.enabled &&
      (isBodyScratchLocked() ||
        (useBodySymbolsRef.current &&
          revealedSymbolsRef.current < SYMBOL_SLOT_COUNT))
    ) {
      return;
    }
    if (patch.enabled && soundEnabledRef.current)
      ensureSymbolAudio(symbolAudioRef.current);
    setAutoScratch((current) => ({ ...current, ...patch }));
  }

  function updateCursorFx(patch: Partial<CursorFxSettings>) {
    if (
      patch.particleCount !== undefined ||
      patch.fadeSpeed !== undefined ||
      patch.particleSize !== undefined ||
      patch.gravity !== undefined
    ) {
      resetFairyDustPerfPeak();
    }
    setCursorFx((current) => ({ ...current, ...patch }));
  }

  function beginFinishAutoScratch() {
    autoPathIndexRef.current = 0;
    autoPathProgressRef.current = 0;
    if (soundEnabledRef.current) ensureSymbolAudio(symbolAudioRef.current);
    finishAutoActiveRef.current = true;
  }

  // Hold top-bar until theme intro + 3-2-1 finish and card clips have a frame.
  // While the intro cover is dissolving (`introLeaving`), unlock early so the
  // scratch-to-start bar can spring in over the live stage — that's the beat.
  const matchStartUnlocked =
    handStartIntroResolved &&
    !introActive &&
    (!introCover || introLeaving) &&
    !handStartCountdownPending &&
    (!gameMode || gameVideosReady);
  // Docked 6-slot chrome can paint before play unlock (lab first paint / mesh
  // load). Keep this separate from matchStartUnlocked so scratch stays gated.
  const topChromeBarReady =
    topBarPhase === "docked" && (skipToPlay || matchStartUnlocked);
  const symbolsHuntComplete =
    useBodySymbols && revealedSymbols >= SYMBOL_SLOT_COUNT;
  const huntPhase = resolveHuntPhase({
    active:
      useBodySymbols &&
      matchStartUnlocked &&
      !introGateActive &&
      !introActive &&
      !introCover &&
      !gameResult,
    topBarPhase,
    found: revealedSymbols,
    total: SYMBOL_SLOT_COUNT,
  });
  const motionOutcome = resolveScratchOutcome({
    scratchCompleted: motionResult != null,
    photoCardFound: Boolean(motionResult?.win && motionResult.photos.length > 0),
    diamondFound: false,
  });
  // Keep the frame mounted through the no-match beat so its energy can drain
  // instead of vanishing with the rest of the gameplay HUD.
  const frameSettling = useBodySymbols && motionOutcome === "no-match";
  const frameProgressActive =
    (useBodySymbols &&
      matchStartUnlocked &&
      !introGateActive &&
      !introActive &&
      !introCover &&
      !gameResult &&
      topBarPhase !== "center" &&
      (huntPhase === "hunt" || revealedSymbols >= SYMBOL_SLOT_COUNT)) ||
    frameSettling;
  const autoScratchLocked =
    !matchStartUnlocked ||
    introActive ||
    introCover ||
    (useBodySymbols &&
      (!symbolsHuntComplete || topBarPhase === "center" || introGateActive));
  // Sparkles only during the hunt play window (after countdown, before all
  // symbols found); cards without body symbols have no countdown gate.
  const cursorFxPlayWindow =
    matchStartUnlocked &&
    !introActive &&
    !introCover &&
    (!useBodySymbols ||
      (topBarPhase !== "center" && !introGateActive && !symbolsHuntComplete));
  // Win-feel trail: celebrate window after each +10%. Fine pointer spawns while
  // scratching on mesh; coarse defers spawn until pointer-up (Phase 9).
  const cursorFxSpawnActive = shouldSpawnFairyDust({
    playWindow: cursorFxPlayWindow,
    celebrate: cursorFxCelebrate,
    isScratching,
    cursorOnMesh,
    coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
  });
  const cursorFxSpawnCount = cursorFxCelebrate
    ? celebrateParticleBoost(cursorFx.particleCount)
    : cursorFx.particleCount;

  useEffect(() => {
    return () => {
      clearCelebrateTimer();
      clearCoinBadgeIdleTimer();
      clearLabDockPreviewTimer();
    };
  }, []);

  // Drop a persisted/stale auto-scratch enable while the hunt is still locked.
  useEffect(() => {
    if (!autoScratchLocked) return;
    if (!autoScratch.enabled) return;
    autoScratchRef.current = { ...autoScratchRef.current, enabled: false };
    setAutoScratch((current) =>
      current.enabled ? { ...current, enabled: false } : current,
    );
  }, [autoScratchLocked, autoScratch.enabled]);

  function updateSoundEnabled(enabled: boolean) {
    // Store write → synchronous notify → the subscription above unlocks audio
    // and mirrors the flag into local state.
    setSoundEffectEnabled(enabled);
  }

  function isPhoneLayout() {
    // Product embed always uses the phone-frame cover layout (see game.css),
    // even on wide desktops — matchMedia alone would treat those as desktop.
    if (
      typeof document !== "undefined" &&
      document.documentElement.dataset.scratchGame === "1"
    ) {
      return true;
    }
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 700px)").matches
    );
  }

  function resetScratch() {
    clearScratchMarks(marksRef.current);
    clearPendingScratchMove(scratchInputCoalesceRef.current);
    lastScratchWorldRef.current = null;
    glRendererRef.current?.clearScratch();
    glRendererRef.current?.clearFlakes();
    revealedRef.current = new Array(revealSamplesRef.current.length).fill(
      false,
    );
    revealedCountRef.current = 0;
    progressRef.current = 0;
    celebrateProgressRef.current = 0;
    clearCelebrateTimer();
    setCursorFxCelebrate(false);
    setSparkleDelta(0);
    setCoinPopNonce(0);
    clearCoinBadgeIdleTimer();
    setCoinBadgeLeaving(false);
    setCoinBadgeShown(true);
    setCoinBadgeEnterKey((k) => k + 1);
    claimedRef.current = false;
    fgParkedRef.current = false;
    huntHintActivityAtRef.current = performance.now();
    huntHintCycleRef.current = { index: -1, shownAt: 0, phase: "show" };
    resetGameOutcome();
    revealedSymbolsRef.current = 0;
    revealedPointsRef.current = Array.from(
      { length: SYMBOL_SLOT_COUNT },
      () => false,
    );
    autoPathIndexRef.current = 0;
    autoPathProgressRef.current = 0;
    resetMatchRound();
    publishedProgressRef.current = 0;
    publishProgressUi(true);
    setClaimed(false);
    publishRevealedSymbols(0);
    setLitSymbolSlots(
      Array.from({ length: SYMBOL_SLOT_COUNT }, () => false),
    );
    setFrameDiscoveryBatches([]);
    frameDiscoveryKeyRef.current = 0;
    setBodyRevealed(Array.from({ length: SYMBOL_SLOT_COUNT }, () => false));
    setBodyFindHits(Array.from({ length: SYMBOL_SLOT_COUNT }, () => false));
    bodyFindHitsRef.current = Array.from(
      { length: SYMBOL_SLOT_COUNT },
      () => false,
    );
    setLitTopSlots(Array.from({ length: TOP_SYMBOL_COUNT }, () => false));
    claimedTopSlotsRef.current = Array.from(
      { length: TOP_SYMBOL_COUNT },
      () => false,
    );
    setFlyingCoins([]);
    finishAutoActiveRef.current = false;
    autoScratchRef.current = { ...autoScratchRef.current, enabled: false };
    setAutoScratch((current) => ({ ...current, enabled: false }));
  }
  resetScratchRef.current = resetScratch;

  async function commitMotionCardResult(
    cardId: string,
    prize: number,
  ): Promise<boolean> {
    const session = loadGameSession();
    if (session?.packScratch) {
      const settle = await settlePackMotionCard(cardId);
      if (!settle.ok) return false;
      if (settle.session) setGameSession(settle.session);
    }

    const updated = recordMotionCardResult(cardId, prize);
    if (!updated) return false;
    setGameSession(updated);
    packRevealBlockedRef.current = false;
    setPackRevealFailed(false);
    return true;
  }

  function abortPackRevealAttempt() {
    clearGameResultTimer();
    gameResultPendingRef.current = null;
    packRevealBlockedRef.current = true;
    resumeForegroundDecoder();
    setPackRevealFailed(true);
  }

  async function retryPackReveal() {
    if (!packRevealFailed || packRevealRetrying) return;
    setPackRevealRetrying(true);
    try {
      await presentMotionResult();
    } finally {
      setPackRevealRetrying(false);
    }
  }

  /** /game-ui lab: after symbols are found, replay this card instead of leaving. */
  function restartCurrentCardLab() {
    if (!skipToPlay) return;
    finishAutoActiveRef.current = false;
    clearGameResultTimer();
    if (gameResultLeaveTimerRef.current !== null) {
      window.clearTimeout(gameResultLeaveTimerRef.current);
      gameResultLeaveTimerRef.current = null;
    }
    clearPendingMotionResult();
    setMotionResult(null);
    setPackRevealFailed(false);
    setPackRevealRetrying(false);
    packRevealBlockedRef.current = false;
    cardTransitionActiveRef.current = false;
    cardTransitionHandoffRef.current = false;
    setCardTransition(null);
    setCardTransitionReady(false);
    // Keep the same card selected; token forces the card-load reset effect.
    setLabRestartToken((n) => n + 1);
    requestAnimationFrame(() => kickGameVideos());
  }

  async function presentMotionResult() {
    const finishedId = selectedCardId;
    if (!finishedId) return;
    // Lab: never advance / navigate — loop the same card for UI testing.
    if (skipToPlay) {
      restartCurrentCardLab();
      return;
    }
    if (completedCardIdsRef.current.includes(finishedId)) return;
    const match = matchOutcomeRef.current ?? matchOutcome;
    const result =
      gameResultPendingRef.current ?? gameResultRef.current ?? gameResult;
    let prize = 0;
    if (match) {
      prize = match.prize;
    } else if (result === "win") {
      prize = 1;
    }

    if (gameMode) {
      const committed = await commitMotionCardResult(finishedId, prize);
      if (!committed) {
        abortPackRevealAttempt();
        return;
      }
      // One catalog fetch for award + overlay photos (used to load twice).
      const catalog = prize > 0 ? await loadGameCatalog() : null;
      const awarded = await awardMotionCardPhotos(
        finishedId,
        prize,
        catalog ?? undefined,
      );
      if (awarded) setGameSession(awarded);
      const pending = awarded?.pendingMotionResult;
      const photoIds = pending?.photoIds ?? awarded?.lastMotionWinPhotoIds ?? [];
      const photos = catalog
        ? photoIds
            .map((id) => catalog.photos.find((photo) => photo.id === id))
            .filter((photo): photo is PhotoCard => Boolean(photo))
        : [];
      const current = pending?.current ?? completedCardIdsRef.current.length + 1;
      const total = awarded?.motionCardIds.length ?? modelCards.length;
      if (!completedCardIdsRef.current.includes(finishedId)) {
        const nextCompleted = [...completedCardIdsRef.current, finishedId];
        completedCardIdsRef.current = nextCompleted;
        setCompletedCardIds(nextCompleted);
      }
      setMotionResult({
        win: prize > 0 && photos.length > 0,
        photos,
        current,
        total,
        resultId: `${finishedId}:${photoIds.join(",")}:${current}`,
      });
      return;
    }

    advanceAfterScratchRef.current();
  }

  function afterMotionResultPresentation() {
    const result = motionResultRef.current;
    setMotionResult(null);
    clearPendingMotionResult();
    if (!result) return;
    if (result.current >= result.total) {
      deferIntroForPendingResultRef.current = false;
      pendingResultCardIdRef.current = null;
      void goToPhotoSummary();
      return;
    }
    goToNextMotionCard();
  }

  async function goToPhotoSummary() {
    clearPendingMotionResult();
    setMotionResult(null);
    const finished = await finishMotionHand();
    if (!finished) {
      navigateTo("/game");
      return;
    }
    setGameSession(finished);
    navigateTo("/game");
  }

  function goToNextMotionCard() {
    const finishedId = selectedCardId;
    if (!finishedId) return;
    finishAutoActiveRef.current = false;
    revealedSymbolsRef.current = 0;
    autoPathIndexRef.current = 0;
    autoPathProgressRef.current = 0;
    clearPendingMotionResult();
    setMotionResult(null);
    const nextCompleted = completedCardIdsRef.current.includes(finishedId)
      ? completedCardIdsRef.current
      : [...completedCardIdsRef.current, finishedId];
    completedCardIdsRef.current = nextCompleted;
    setCompletedCardIds(nextCompleted);
    const nextCard = modelCards.find(
      (entry) => entry.id !== finishedId && !nextCompleted.includes(entry.id),
    );
    const finishedCard =
      modelCards.find((entry) => entry.id === finishedId) ?? card;
    resetGameOutcome();
    setClaimed(false);
    claimedRef.current = false;
    fgParkedRef.current = false;
    // Pack / game hand: hard-cut to the next card. The mirror-slide transition
    // re-decodes both videos and then waits for stage ready (~1–3s of dead air).
    if (nextCard && gameMode) {
      setSelectedCardId(nextCard.id);
      return;
    }
    if (nextCard && finishedCard?.bottom && nextCard.foreground) {
      const { id: templateId, nextIndex } = nextTemplateId(
        transitionTemplateIndexRef.current,
      );
      transitionTemplateIndexRef.current = nextIndex;
      cardTransitionActiveRef.current = true;
      cardTransitionHandoffRef.current = false;
      setCardTransitionReady(false);
      setCardTransition({
        fromBottom: finishedCard.bottom,
        toForeground: nextCard.foreground,
        templateId,
        nextCardId: nextCard.id,
        finishedId,
        prize: 0,
      });
      return;
    }
    if (nextCard) {
      setSelectedCardId(nextCard.id);
      return;
    }
    void goToPhotoSummary();
  }

  async function beginCardTransitionHandoff(transition: CardTransitionState) {
    if (cardTransitionHandoffRef.current) return;
    cardTransitionHandoffRef.current = true;
    setCardTransitionReady(false);
    setGameVideosReady(false);
    glRendererRef.current?.resetForeground();
    if (gameMode) {
      const committed = await commitMotionCardResult(
        transition.finishedId,
        transition.prize,
      );
      if (!committed) {
        cardTransitionHandoffRef.current = false;
        abortPackRevealAttempt();
        return;
      }
    }
    if (!completedCardIdsRef.current.includes(transition.finishedId)) {
      const nextCompleted = [
        ...completedCardIdsRef.current,
        transition.finishedId,
      ];
      completedCardIdsRef.current = nextCompleted;
      setCompletedCardIds(nextCompleted);
    }
    resetGameOutcome();
    setClaimed(false);
    claimedRef.current = false;
    fgParkedRef.current = false;
    setSelectedCardId(transition.nextCardId);
  }

  function finishCardTransition() {
    cardTransitionActiveRef.current = false;
    cardTransitionHandoffRef.current = false;
    setCardTransitionReady(false);
    setCardTransition(null);
  }

  async function advanceAfterScratch() {
    // Lab: same-card loop — never leave /game-ui after a find.
    if (skipToPlay) {
      restartCurrentCardLab();
      return;
    }
    const finishedId = selectedCardId;
    if (!finishedId || completedCardIdsRef.current.includes(finishedId)) return;
    if (cardTransitionActiveRef.current) return;

    const match = matchOutcomeRef.current ?? matchOutcome;
    const result =
      gameResultPendingRef.current ?? gameResultRef.current ?? gameResult;
    let prize = 0;
    if (match) {
      prize = match.prize;
    } else if (result === "win") {
      prize = 1;
    }

    const nextCompleted = [...completedCardIdsRef.current, finishedId];
    const nextCard = modelCards.find(
      (entry) => entry.id !== finishedId && !nextCompleted.includes(entry.id),
    );
    const finishedCard =
      modelCards.find((entry) => entry.id === finishedId) ?? card;

    if (
      nextCard &&
      !gameMode &&
      finishedCard?.bottom &&
      nextCard.foreground
    ) {
      const { id: templateId, nextIndex } = nextTemplateId(
        transitionTemplateIndexRef.current,
      );
      transitionTemplateIndexRef.current = nextIndex;
      cardTransitionActiveRef.current = true;
      cardTransitionHandoffRef.current = false;
      setCardTransitionReady(false);
      setCardTransition({
        fromBottom: finishedCard.bottom,
        toForeground: nextCard.foreground,
        templateId,
        nextCardId: nextCard.id,
        finishedId,
        prize,
      });
      return;
    }

    if (gameMode) {
      const committed = await commitMotionCardResult(finishedId, prize);
      if (!committed) {
        abortPackRevealAttempt();
        return;
      }
    }

    completedCardIdsRef.current = nextCompleted;
    setCompletedCardIds(nextCompleted);
    resetGameOutcome();
    setClaimed(false);
    claimedRef.current = false;
    fgParkedRef.current = false;
    if (nextCard) {
      setSelectedCardId(nextCard.id);
      return;
    }
    setSelectedCardId("");
    if (gameMode) {
      void finishMotionHand().then((finished) => {
        if (!finished) {
          navigateTo("/game");
          return;
        }
        setGameSession(finished);
        // Return to pack-fan hub for photo reveal / New Game.
        navigateTo("/game");
      });
      return;
    }
    // Collection single-card play — no Next card, return to the album.
    if (!playlistMode) {
      const params = new URLSearchParams(window.location.search);
      navigateTo(collectionReturnHref(params.get("model"), params.get("card")));
    }
  }
  advanceAfterScratchRef.current = advanceAfterScratch;

  function tryResolveGame() {
    if (gameResultPendingRef.current !== null) return;
    if (packRevealBlockedRef.current) return;
    const autoMode = autoScratchRef.current.enabled;
    const sampleCount = revealSamplesRef.current.length;
    if (
      !isGarmentFullyRevealed(
        progressRef.current,
        revealedCountRef.current,
        sampleCount,
        autoMode,
      )
    ) {
      return;
    }
    // Symbol hunt cards wait for all symbols; plain scratch cards advance on full reveal.
    if (
      useBodySymbolsRef.current &&
      revealedSymbolsRef.current < SYMBOL_SLOT_COUNT
    ) {
      return;
    }
    let outcome: GameResult;
    let match: MatchGameOutcome | null = null;
    if (useBodySymbolsRef.current) {
      match = resolveMatchGame(
        topSymbolsRef.current,
        sessionSymbolsRef.current,
      );
      outcome = match.result;
    } else {
      // Legacy path (no body anchors): any type appearing ≥3 times wins.
      const LEGACY_WIN_MATCH_COUNT = 3;
      const counts = new Array(SYMBOL_TYPE_COUNT).fill(0);
      outcome = "lose";
      for (const id of sessionSymbolsRef.current) {
        counts[id] += 1;
        if (counts[id] >= LEGACY_WIN_MATCH_COUNT) {
          outcome = "win";
          break;
        }
      }
    }
    gameResultPendingRef.current = outcome;
    matchOutcomeRef.current = match;
    gameResultRef.current = outcome;
    setMatchOutcome(match);
    finishAutoActiveRef.current = false;
    autoScratchRef.current = { ...autoScratchRef.current, enabled: false };
    setAutoScratch((current) =>
      current.enabled ? { ...current, enabled: false } : current,
    );
    const advanceDelayMs = playGameOutcomeSound(
      symbolAudioRef.current,
      outcome,
      soundEnabledRef.current,
    );
    clearGameResultTimer();
    // Body-hunt cards: short showcase pulse, then result / next card.
    // Don't hold the handoff for the full outcome sound — let it play under.
    if (useBodySymbolsRef.current) {
      setTopBarPhase("showcase");
      topBarPhaseRef.current = "showcase";
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const showcaseMs = reduceMotion
        ? Math.min(advanceDelayMs, 300)
        : TOP_BAR_SHOWCASE_MS;
      gameResultTimerRef.current = window.setTimeout(() => {
        gameResultTimerRef.current = null;
        void presentMotionResult();
      }, showcaseMs);
      return;
    }
    // Plain scratch: don't wait on the multi-second win fanfare before advancing.
    gameResultTimerRef.current = window.setTimeout(() => {
      gameResultTimerRef.current = null;
      void presentMotionResult();
    }, Math.min(advanceDelayMs, TOP_BAR_SHOWCASE_MS));
  }
  tryResolveGameRef.current = tryResolveGame;

  // On phones the canvas is centered with a translate that fills the screen, so
  // the magnify scale has to be composed on top of it rather than replacing it.
  const canvasBaseTransform = () =>
    isPhoneLayout() ? "translate(-50%, -50%) " : "";

  function applyScratchZoom(point: Vec2) {
    const settings = scratchZoomRef.current;
    if (!settings.enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    syncScratchZoomTransition(canvas, settings);
    canvas.style.transformOrigin = `${(point.x / CANVAS_WIDTH) * 100}% ${(point.y / CANVAS_HEIGHT) * 100}%`;
    canvas.style.transform = `${canvasBaseTransform()}scale(${settings.scale})`;
  }

  function clearScratchZoom() {
    const settings = scratchZoomRef.current;
    if (!settings.enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    syncScratchZoomTransition(canvas, settings);
    canvas.style.transform = `${canvasBaseTransform()}scale(1)`;
  }

  function getCanvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    // Screen -> presented canvas pixels.
    const presentX = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const presentY = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    // Invert the chest-follow camera (overscan + clip-space pan) so a tap maps to
    // the reference-frame fabric coordinate the mesh/holes live in.
    const cam = cameraRef.current;
    const refClipX = ((presentX / CANVAS_WIDTH) * 2 - 1 - cam.x) / PRESENT_ZOOM;
    const refClipY =
      (1 - (presentY / CANVAS_HEIGHT) * 2 - cam.y) / PRESENT_ZOOM;
    return {
      x: ((refClipX + 1) / 2) * CANVAS_WIDTH,
      y: ((1 - refClipY) / 2) * CANVAS_HEIGHT,
    };
  }

  // Fly a coin from the scratch origin up to each newly revealed symbol slot.
  // Auto scratch starts the flight from the stage center; manual scratch starts
  // it from the user's finger. Coordinates are resolved against the live stage
  // and symbol-bar layout so the coins land on the correct slots.
  // Convert a canvas reference-frame point (the space scratches live in) to a
  // stage-relative pixel. Applies the same chest-follow camera + present-zoom
  // forward transform the GL renderer uses, then maps presented canvas pixels
  // through the live canvas rect so it lands where the point visually appears.
  function worldToStagePoint(worldPoint: Vec2): Vec2 | null {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return null;
    return worldPointToStage(worldPoint, canvas, stage, cameraRef.current);
  }

  function spawnSymbolCoins(
    prevCount: number,
    nextCount: number,
    worldPoint?: Vec2 | null,
  ) {
    const stage = stageRef.current;
    if (!stage || nextCount <= prevCount) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setLitSymbolSlots((prev) => {
        const next = prev.slice();
        let changed = false;
        for (let slot = prevCount; slot < nextCount; slot += 1) {
          if (!next[slot]) {
            next[slot] = true;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      return;
    }

    const stageRect = stage.getBoundingClientRect();

    const autoMode = autoScratchRef.current.enabled;
    let originX: number;
    let originY: number;
    const autoOrigin =
      autoMode && worldPoint ? worldToStagePoint(worldPoint) : null;
    if (autoOrigin) {
      originX = autoOrigin.x;
      originY = autoOrigin.y;
    } else if (autoMode || !lastPointerClientRef.current) {
      originX = stageRect.width / 2;
      originY = stageRect.height / 2;
    } else {
      originX = lastPointerClientRef.current.x - stageRect.left;
      originY = lastPointerClientRef.current.y - stageRect.top;
    }

    const symbols = sessionSymbolsRef.current;
    const coins: FlyingCoin[] = [];
    for (let slot = prevCount; slot < nextCount; slot += 1) {
      const slotEl = symbolSlotRefs.current[slot];
      if (!slotEl) {
        setLitSymbolSlots((prev) => {
          if (prev[slot]) return prev;
          const next = prev.slice();
          next[slot] = true;
          return next;
        });
        continue;
      }
      const slotRect = slotEl.getBoundingClientRect();
      const toX = slotRect.left - stageRect.left + slotRect.width / 2;
      const toY = slotRect.top - stageRect.top + slotRect.height / 2;
      // Lift the midpoint above the straight line for a gentle arc toward the bar.
      const midX = (originX + toX) / 2;
      const midY = Math.min(originY, toY) - 56;
      coins.push({
        id: (coinIdRef.current += 1),
        typeId: symbols[slot] ?? 0,
        fromX: originX,
        fromY: originY,
        toX,
        toY,
        midX,
        midY,
        delayMs: (slot - prevCount) * COIN_FLIGHT_STAGGER_MS,
        topSlot: slot,
      });
    }
    if (coins.length > 0) {
      setFlyingCoins((current) => [...current, ...coins]);
    }
  }

  function removeFlyingCoin(id: number) {
    setFlyingCoins((current) => {
      const coin = current.find((entry) => entry.id === id);
      const rest = current.filter((entry) => entry.id !== id);
      if (coin && typeof coin.topSlot === "number" && coin.topSlot >= 0) {
        const slot = coin.topSlot;
        queueMicrotask(() => {
          if (useBodySymbolsRef.current) {
            setLitTopSlots((prev) => {
              if (prev[slot]) return prev;
              const next = prev.slice();
              next[slot] = true;
              return next;
            });
            return;
          }
          setLitSymbolSlots((prev) => {
            if (prev[slot]) return prev;
            const next = prev.slice();
            next[slot] = true;
            return next;
          });
        });
      }
      return rest;
    });
  }

  function pushFrameDiscoveryBatch(
    newlyRevealed: readonly number[],
    foundAfter: number,
  ) {
    const stage = stageRef.current;
    const sample = trackedSampleRef.current;
    const bodyPoints = trackedMeshRef.current?.symbolPoints;
    if (!stage || !sample || !bodyPoints || newlyRevealed.length === 0) return;

    const stageRect = stage.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0) return;
    const positions: SymbolDiscoveryBatch["positions"] = [];

    for (const bodyIndex of newlyRevealed) {
      const point = bodyPoints[bodyIndex];
      if (!point) continue;
      const world = sampleMeshUvToWorld(sample, point.u, point.v);
      const from = worldToStagePoint(world);
      if (!from) continue;
      positions.push({
        nx: from.x / stageRect.width,
        ny: from.y / stageRect.height,
      });
      const marker = bodyMarkerRefs.current[bodyIndex];
      if (marker) {
        marker.classList.remove("is-symbol-pop");
        void marker.offsetWidth;
        marker.classList.add("is-symbol-pop");
      }
    }

    if (positions.length === 0) return;
    setFrameDiscoveryBatches((prev) => [
      ...prev,
      {
        key: (frameDiscoveryKeyRef.current += 1),
        positions,
        foundAfter,
      },
    ]);
  }

  function spawnBodyMatchFlights(newlyRevealed: readonly number[]) {
    const stage = stageRef.current;
    const sample = trackedSampleRef.current;
    const bodyPoints = trackedMeshRef.current?.symbolPoints;
    if (!stage || !sample || !bodyPoints || newlyRevealed.length === 0) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stageRect = stage.getBoundingClientRect();
    const top = topSymbolsRef.current;
    const body = sessionSymbolsRef.current;
    const claimed = claimedTopSlotsRef.current.slice();
    const coins: FlyingCoin[] = [];
    let flightIndex = 0;

    for (const bodyIndex of newlyRevealed) {
      const typeId = body[bodyIndex];
      if (typeId === undefined) continue;
      const topSlot = claimNextTopSlot(top, typeId, claimed);
      if (topSlot < 0) continue;
      claimed[topSlot] = true;

      if (reduceMotion) {
        setLitTopSlots((prev) => {
          if (prev[topSlot]) return prev;
          const next = prev.slice();
          next[topSlot] = true;
          return next;
        });
        continue;
      }

      const point = bodyPoints[bodyIndex];
      const world = sampleMeshUvToWorld(sample, point.u, point.v);
      const from = worldToStagePoint(world);
      const slotEl = topBarSlotElsRef.current[topSlot];
      if (!from || !slotEl) {
        setLitTopSlots((prev) => {
          if (prev[topSlot]) return prev;
          const next = prev.slice();
          next[topSlot] = true;
          return next;
        });
        continue;
      }

      const slotRect = slotEl.getBoundingClientRect();
      const toX = slotRect.left - stageRect.left + slotRect.width / 2;
      const toY = slotRect.top - stageRect.top + slotRect.height / 2;
      coins.push({
        id: (coinIdRef.current += 1),
        typeId,
        fromX: from.x,
        fromY: from.y,
        toX,
        toY,
        delayMs: flightIndex * MATCH_FLIGHT_STAGGER_MS,
        bodyIndex,
        topSlot,
      });
      flightIndex += 1;
    }

    claimedTopSlotsRef.current = claimed;
    if (coins.length > 0) {
      setFlyingCoins((current) => [...current, ...coins]);
    }
  }

  function applyScratchAtUv(
    u: number,
    v: number,
    radius: number,
    worldPoint?: Vec2 | null,
    finalize = true,
    strokeUvs?: ReadonlyArray<{ u: number; v: number }>,
  ) {
    if (gameResultPendingRef.current !== null) return;
    if (packRevealBlockedRef.current) return;
    if (isBodyScratchLocked()) {
      return;
    }

    if (finalize) huntHintActivityAtRef.current = performance.now();

    pushScratchMark(marksRef.current, u, v, radius);
    glRendererRef.current?.paintScratch(u, v, radius);

    const samples = revealSamplesRef.current;
    const revealed = revealedRef.current;
    for (let i = 0; i < samples.length; i += 1) {
      if (revealed[i]) continue;
      const distance = Math.hypot(
        (u - samples[i].x) / radius,
        (v - samples[i].y) / radius,
      );
      if (distance <= 1) {
        revealed[i] = true;
        revealedCountRef.current += 1;
      }
    }
    if (!finalize) return;

    if (autoScratchRef.current.flakes && worldPoint) {
      glRendererRef.current?.spawnFlakes(worldPoint.x, worldPoint.y);
    }

    const nextProgress = samples.length
      ? revealedCountRef.current / samples.length
      : 0;
    progressRef.current = nextProgress;
    publishProgressUi(false);
    maybeCelebrateScratchProgress(nextProgress);
    const autoMode = autoScratchRef.current.enabled;
    if (useBodySymbolsRef.current && trackedMeshRef.current?.symbolPoints) {
      const bodyPoints = trackedMeshRef.current.symbolPoints;
      const newlyRevealed: number[] = [];
      const revealedBefore = revealedPointsRef.current.slice();
      const renderer = glRendererRef.current;
      const probeFrame = probeFrameIdRef.current;
      const symbolProbeCache = symbolScratchProbeCacheRef.current;
      for (let index = 0; index < bodyPoints.length; index += 1) {
        if (revealedPointsRef.current[index]) continue;
        const nearStroke = strokeUvs
          ? isSymbolNearAnyStroke(
              strokeUvs,
              bodyPoints[index].u,
              bodyPoints[index].v,
              SYMBOL_REVEAL_UV_RADIUS,
            )
          : isSymbolNearStroke(
              u,
              v,
              bodyPoints[index].u,
              bodyPoints[index].v,
              SYMBOL_REVEAL_UV_RADIUS,
            );
        if (!nearStroke) {
          continue;
        }
        // Must have actually punched the clothing at this UV — proximity alone
        // used to pop icons on top of still-blue foil. Reuse a same-frame GPU
        // sample only once it already meets the reveal threshold — a miss must
        // not stick after later stamps in this rAF add more paint.
        if (!renderer) continue;
        let amount = readCachedSymbolScratchAmount(
          symbolProbeCache,
          probeFrame,
          index,
          SYMBOL_SCRATCH_REVEAL_THRESHOLD,
        );
        if (amount === null) {
          amount = writeCachedSymbolScratchAmount(
            symbolProbeCache,
            probeFrame,
            index,
            renderer.scratchAmountAt(bodyPoints[index].u, bodyPoints[index].v),
          );
        }
        if (amount < SYMBOL_SCRATCH_REVEAL_THRESHOLD) continue;
        revealedPointsRef.current[index] = true;
        newlyRevealed.push(index);
      }
      if (newlyRevealed.length > 0) {
        const nextSymbolCount =
          revealedPointsRef.current.filter(Boolean).length;
        revealedSymbolsRef.current = nextSymbolCount;
        publishRevealedSymbols(nextSymbolCount);
        setBodyRevealed(revealedPointsRef.current.slice());
        setBodyFindHits((prev) => {
          const next = applyBodyFindHits(
            topSymbolsRef.current,
            sessionSymbolsRef.current,
            revealedBefore,
            newlyRevealed,
            prev,
          );
          bodyFindHitsRef.current = next;
          return next;
        });
        playBodyFindSounds(
          symbolAudioRef.current,
          topSymbolsRef.current,
          sessionSymbolsRef.current,
          revealedBefore,
          newlyRevealed,
          soundEnabledRef.current,
        );
        pushFrameDiscoveryBatch(newlyRevealed, nextSymbolCount);
        spawnBodyMatchFlights(newlyRevealed);
        if (nextSymbolCount >= SYMBOL_SLOT_COUNT) {
          beginFinishAutoScratch();
        }
      }
    } else {
      const nextSymbolCount = revealedSymbolCount(nextProgress, autoMode);
      if (nextSymbolCount !== revealedSymbolsRef.current) {
        const prevCount = revealedSymbolsRef.current;
        revealedSymbolsRef.current = nextSymbolCount;
        publishRevealedSymbols(nextSymbolCount);
        playNewSymbolNotes(
          symbolAudioRef.current,
          prevCount,
          nextSymbolCount,
          soundEnabledRef.current,
        );
        spawnSymbolCoins(prevCount, nextSymbolCount, worldPoint);
      }
    }
    const canClaimGarment =
      !useBodySymbolsRef.current ||
      revealedSymbolsRef.current >= SYMBOL_SLOT_COUNT;
    if (
      canClaimGarment &&
      !packRevealBlockedRef.current &&
      isGarmentFullyRevealed(
        nextProgress,
        revealedCountRef.current,
        samples.length,
        autoMode,
      )
    ) {
      claimedRef.current = true;
      setClaimed(true);
      publishProgressUi(true);
    }
    tryResolveGame();
  }
  applyScratchAtUvRef.current = applyScratchAtUv;

  function addScratch(clientX: number, clientY: number) {
    if (isBodyScratchLocked()) {
      return;
    }
    const point = getCanvasPoint(clientX, clientY);
    if (!point) return;

    const trackedSample = trackedSampleRef.current;
    if (!trackedSample) return;

    const last = lastScratchWorldRef.current;
    const manualBudget = resolveManualScratchBudget({
      coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
    });
    const strokePoints =
      last !== null
        ? densifyStrokeSegment(
            last,
            point,
            manualBudget.pathStep,
            manualBudget.maxPoints,
          )
        : [point];

    // Map first so we finalize the last *on-mesh* stamp. A coalesced swipe
    // often ends off the garment; finalizing `strokePoints.at(-1)` skipped
    // symbol probes even when an intermediate stamp punched a mark.
    const appliedStamps: { u: number; v: number; worldPoint: Vec2 }[] = [];
    for (let i = 0; i < strokePoints.length; i += 1) {
      const strokePoint = strokePoints[i];
      const uv = trackedWorldToUv(trackedSample, strokePoint);
      if (!uv) continue;
      appliedStamps.push({ u: uv.x, v: uv.y, worldPoint: strokePoint });
    }

    let applied = false;
    for (let i = 0; i < appliedStamps.length; i += 1) {
      const stamp = appliedStamps[i];
      const isLast = i === appliedStamps.length - 1;
      applyScratchAtUv(
        stamp.u,
        stamp.v,
        SCRATCH_RADIUS,
        isLast ? stamp.worldPoint : null,
        isLast,
        isLast ? appliedStamps : undefined,
      );
      applied = true;
    }

    if (applied) lastScratchWorldRef.current = point;

    const uvAtPointer = trackedWorldToUv(trackedSample, point);
    // Fabric alpha is only for fairy-dust spawn gating. Skip readPixels when
    // dust is off or coarse mid-stroke (Phase 9 defers spawn to pointer-up).
    let onFabric = true;
    if (
      shouldSampleFabricAlpha({
        fairyDust: cursorFxRef.current.fairyDust,
        coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
        isScratching: drawingRef.current,
      })
    ) {
      const probeFrame = probeFrameIdRef.current;
      const fabricCache = fabricAlphaCacheRef.current;
      let fabricAlpha = readCachedFabricAlpha(fabricCache, probeFrame);
      if (fabricAlpha === null) {
        fabricAlpha = writeCachedFabricAlpha(
          fabricCache,
          probeFrame,
          glRendererRef.current?.foregroundAlphaAt(point.x, point.y) ?? -1,
        );
      }
      onFabric = fabricAlpha < 0 || fabricAlpha >= CURSOR_FX_MESH_ALPHA_MIN;
    }
    const onMesh = applied && uvAtPointer !== null && onFabric;
    publishCursorOnMesh(onMesh);
  }
  addScratchRef.current = addScratch;

  function setVideoTime(time: number) {
    const bottomVideo = bottomVideoRef.current;
    const foregroundVideo = foregroundVideoRef.current;
    const nextTime = Math.max(0, Math.min(duration || 0, time));

    if (bottomVideo) bottomVideo.currentTime = nextTime;
    if (
      !fgParkedRef.current &&
      foregroundVideo &&
      Number.isFinite(foregroundVideo.duration) &&
      foregroundVideo.duration > 0 &&
      bottomVideo
    ) {
      foregroundVideo.currentTime = foregroundTimeFromBottom(
        bottomVideo,
        foregroundVideo,
      );
    }
    uiStateRef.current = {
      ...uiStateRef.current,
      currentTime: nextTime,
      lastUpdatedAt: performance.now(),
    };
    setCurrentTime(nextTime);
  }

  function togglePlayback() {
    const bottomVideo = bottomVideoRef.current;
    const foregroundVideo = foregroundVideoRef.current;
    if (!bottomVideo || !foregroundVideo) return;

    if (bottomVideo.paused) {
      void bottomVideo.play();
      if (!fgParkedRef.current) void foregroundVideo.play();
      uiStateRef.current = { ...uiStateRef.current, isPaused: false };
      setIsPaused(false);
    } else {
      bottomVideo.pause();
      if (!fgParkedRef.current) foregroundVideo.pause();
      uiStateRef.current = { ...uiStateRef.current, isPaused: true };
      setIsPaused(true);
    }
  }

  const scratchZoomControls = (
    <fieldset className="scratch-zoom-settings">
      <legend>Scratch zoom</legend>
      <label className="checkbox-label">
        <input
          checked={scratchZoom.enabled}
          onChange={(event) =>
            updateScratchZoom({ enabled: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Enable zoom while scratching
      </label>
      <label>
        Range ({scratchZoom.scale.toFixed(2)}×)
        <input
          disabled={!scratchZoom.enabled}
          max={2}
          min={1}
          onChange={(event) =>
            updateScratchZoom({ scale: Number(event.currentTarget.value) })
          }
          step={0.05}
          type="range"
          value={scratchZoom.scale}
        />
      </label>
      <label>
        Animation ({scratchZoom.durationMs} ms)
        <input
          disabled={!scratchZoom.enabled}
          max={800}
          min={50}
          onChange={(event) =>
            updateScratchZoom({ durationMs: Number(event.currentTarget.value) })
          }
          step={10}
          type="range"
          value={scratchZoom.durationMs}
        />
      </label>
      <label className="checkbox-label">
        <input
          checked={scratchZoom.bounce}
          disabled={!scratchZoom.enabled}
          onChange={(event) =>
            updateScratchZoom({ bounce: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Bounce easing
      </label>
    </fieldset>
  );

  const soundControls = (
    <fieldset className="scratch-zoom-settings">
      <legend>Sound</legend>
      <label className="checkbox-label">
        <input
          checked={soundEnabled}
          onChange={(event) => updateSoundEnabled(event.currentTarget.checked)}
          type="checkbox"
        />
        Game sounds
      </label>
    </fieldset>
  );

  const autoScratchControls = (
    <fieldset className="scratch-zoom-settings">
      <legend>Auto scratch</legend>
      {autoScratchLocked ? (
        <p className="auto-scratch-hint">
          {introActive || introCover
            ? "Intro + countdown — play unlocks when both finish."
            : topBarPhase === "center"
              ? "Scratch the foil, then match symbols on her — auto scratch finishes the reveal."
              : introGateActive
                ? "Get ready — play starts after the countdown."
                : `Find all ${SYMBOL_SLOT_COUNT} matches first — auto scratch finishes the reveal.`}
        </p>
      ) : null}
      <label className="checkbox-label">
        <input
          checked={autoScratch.enabled}
          disabled={autoScratchLocked}
          onChange={(event) =>
            updateAutoScratch({ enabled: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Enable auto scratch
      </label>
      <label>
        Speed ({autoScratch.speed.toFixed(0)} pts/s)
        <input
          disabled={!autoScratch.enabled}
          max={120}
          min={1}
          onChange={(event) =>
            updateAutoScratch({ speed: Number(event.currentTarget.value) })
          }
          step={1}
          type="range"
          value={autoScratch.speed}
        />
      </label>
      <label className="checkbox-label">
        <input
          checked={autoScratch.flakes}
          onChange={(event) =>
            updateAutoScratch({ flakes: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Flying flakes
      </label>
    </fieldset>
  );

  const cursorFxControls = (
    <fieldset className="scratch-zoom-settings">
      <legend>Cursor FX</legend>
      {cursorFx.fairyDust && !cursorFxPlayWindow ? (
        <p className="auto-scratch-hint">
          {introActive || introCover
            ? "Intro + countdown — cursor FX starts when play unlocks."
            : topBarPhase === "center"
              ? "Scratch the foil first — cursor FX starts after the countdown."
              : introGateActive
                ? "Get ready — cursor FX starts after the countdown."
                : "Cursor FX pauses once all symbols are found."}
        </p>
      ) : null}
      <label className="checkbox-label">
        <input
          checked={cursorFx.fairyDust}
          onChange={(event) =>
            updateCursorFx({ fairyDust: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Fairy Dust
      </label>
      <label>
        Particle size ({cursorFx.particleSize})
        <input
          disabled={!cursorFx.fairyDust}
          max={64}
          min={10}
          onChange={(event) =>
            updateCursorFx({ particleSize: Number(event.currentTarget.value) })
          }
          step={1}
          type="range"
          value={cursorFx.particleSize}
        />
      </label>
      <label>
        Particles per move ({cursorFx.particleCount})
        <input
          disabled={!cursorFx.fairyDust}
          max={8}
          min={1}
          onChange={(event) =>
            updateCursorFx({ particleCount: Number(event.currentTarget.value) })
          }
          step={1}
          type="range"
          value={cursorFx.particleCount}
        />
      </label>
      <label>
        Gravity ({cursorFx.gravity.toFixed(3)})
        <input
          disabled={!cursorFx.fairyDust}
          max={0.1}
          min={0}
          onChange={(event) =>
            updateCursorFx({ gravity: Number(event.currentTarget.value) })
          }
          step={0.005}
          type="range"
          value={cursorFx.gravity}
        />
      </label>
      <label>
        Fade speed ({cursorFx.fadeSpeed.toFixed(2)})
        <input
          disabled={!cursorFx.fairyDust}
          max={0.99}
          min={0.9}
          onChange={(event) =>
            updateCursorFx({ fadeSpeed: Number(event.currentTarget.value) })
          }
          step={0.01}
          type="range"
          value={cursorFx.fadeSpeed}
        />
      </label>
      {cursorFx.fairyDust ? (
        <p className="auto-scratch-hint">
          Active {cursorFxPerf.active} · peak {cursorFxPerf.peak} ·{" "}
          {cursorFxPerf.avgFrameMs.toFixed(2)}ms/frame
          {cursorFxPerf.peak >= 220 ? " — near cap (250)" : ""}
        </p>
      ) : null}
    </fieldset>
  );

  const desktopSettingsTabs = (
    <div className="panel-settings-tabs">
      <div
        className="panel-settings-tablist"
        role="tablist"
        aria-label="Settings"
      >
        {DESKTOP_SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`panel-tab-${tab.id}`}
            aria-selected={desktopSettingsTab === tab.id}
            aria-controls={`panel-tabpanel-${tab.id}`}
            className={`panel-settings-tab${desktopSettingsTab === tab.id ? " is-active" : ""}`}
            onClick={() => setDesktopSettingsTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id="panel-tabpanel-scratch-zoom"
        role="tabpanel"
        aria-labelledby="panel-tab-scratch-zoom"
        hidden={desktopSettingsTab !== "scratch-zoom"}
        className="panel-settings-tabpanel"
      >
        {scratchZoomControls}
      </div>
      <div
        id="panel-tabpanel-sound"
        role="tabpanel"
        aria-labelledby="panel-tab-sound"
        hidden={desktopSettingsTab !== "sound"}
        className="panel-settings-tabpanel"
      >
        {soundControls}
      </div>
      <div
        id="panel-tabpanel-auto-scratch"
        role="tabpanel"
        aria-labelledby="panel-tab-auto-scratch"
        hidden={desktopSettingsTab !== "auto-scratch"}
        className="panel-settings-tabpanel"
      >
        {autoScratchControls}
      </div>
      <div
        id="panel-tabpanel-cursor-fx"
        role="tabpanel"
        aria-labelledby="panel-tab-cursor-fx"
        hidden={desktopSettingsTab !== "cursor-fx"}
        className="panel-settings-tabpanel"
      >
        {cursorFxControls}
      </div>
    </div>
  );

  function openModel(modelId: string) {
    const ordered = playlistCardsForModel(cards, modelId);
    setPlaylistMode(true);
    singleCardIdRef.current = "";
    setCompletedCardIds([]);
    completedCardIdsRef.current = [];
    setSelectedCardId("");
    setActiveModelId(modelId);
    setSelectedCardId(ordered[0]?.id ?? "");
  }

  if (showModelPicker) {
    const playableModels = models.filter(
      (model) => playlistCardsForModel(cards, model.id).length > 0,
    );
    return (
      <main className="app-shell home-picker">
        <section className="home-picker-panel">
          <p className="eyebrow">Sugar Scratchie</p>
          <h1>Choose a girl</h1>
          <p className="home-picker-copy">
            Play only her motion cards, in the order you set on Models.
          </p>
          <div className="home-picker-grid">
            {playableModels.map((model) => {
              const count = playlistCardsForModel(cards, model.id).length;
              return (
                <button
                  key={model.id}
                  type="button"
                  className="home-picker-card"
                  onClick={() => openModel(model.id)}
                >
                  <span className="home-picker-avatar">
                    {model.avatar ? (
                      <img alt="" src={model.avatar} />
                    ) : (
                      model.label.slice(0, 1)
                    )}
                  </span>
                  <span className="home-picker-meta">
                    <strong>{model.label}</strong>
                    <span>
                      {count} motion card{count === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {playableModels.length === 0 ? (
            <p className="home-picker-empty">
              No models with motion cards yet.{" "}
              <a href="/collection">Back to My Collection</a>
            </p>
          ) : null}
          <div className="home-picker-links">
            <a href="/collection">My Collection</a>
          </div>
        </section>
      </main>
    );
  }

  // Keep the playable stage mounted while the catalog loads so the dual-video
  // elements aren't torn down/recreated (cold decoder attach = lag + desync).
  if (!cardsReady) {
    return (
      <main className="app-shell">
        <div className="prototype">
          <div className="stage" aria-busy="true" />
        </div>
      </main>
    );
  }

  if (!card) {
    const missingCardCopy = playlistFinished
      ? "All her motion cards are scratched — none left to repeat."
      : gameMode
        ? "Couldn't load this game hand. Try leaving and starting again from your pack."
        : selectedCardId || singleCardIdRef.current
          ? "This motion card isn't available right now. It may have been removed or belongs to another model."
          : "This girl has no motion cards yet.";
    return (
      <main className="app-shell home-picker">
        <section className="home-picker-panel">
          <p className="eyebrow">Sugar Scratchie</p>
          <h1>{activeModel?.label ?? "Can't play this card"}</h1>
          <p className="home-picker-copy">{missingCardCopy}</p>
          <div className="home-picker-links">
            {!gameMode ? (
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setActiveModelId("");
                  setSelectedCardId("");
                  singleCardIdRef.current = "";
                  setCompletedCardIds([]);
                  completedCardIdsRef.current = [];
                }}
              >
                Choose another girl
              </button>
            ) : null}
            <a href="/collection">My Collection</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="prototype">
        <div
          ref={setStageNode}
          className={`stage${gameResult ? " is-game-over" : ""}${
            topBarPhase === "showcase" ? " is-showcase-phase" : ""
          }${
            ((useBodySymbols && matchStartUnlocked) ||
              (skipToPlay && !labTopBarForceRevealed)) &&
            topBarPhase === "center" &&
            !introGateActive
              ? " is-bar-phase"
              : ""
          }${useBodySymbols && introGateActive ? " is-countdown-phase" : ""}${
            introCover ? " is-intro-video-phase" : ""
          }${introLeaving ? " is-intro-revealing" : ""}`}
        >
          {cursorFx.fairyDust && cursorHost ? (
            <FairyDustCursor
              element={cursorHost}
              particleTypes={cursorFxParticleTypes}
              particleSize={cursorFx.particleSize}
              particleCount={cursorFxSpawnCount}
              gravity={cursorFx.gravity}
              fadeSpeed={cursorFx.fadeSpeed}
              initialVelocity={CURSOR_FX_INITIAL_VELOCITY}
              spawnEnabled={cursorFxSpawnActive}
              maxDevicePixelRatio={CURSOR_FX_DEVICE.maxOverlayDpr}
              burstNonce={cursorFxBurstNonce}
              burstCount={celebrateParticleBoost(cursorFx.particleCount) * 2}
            />
          ) : null}
          {glError ? (
            <div
              className="game-result game-result--static"
              role="alert"
              style={{ pointerEvents: "auto" }}
            >
              <div className="game-result-iris">
                <div className="game-result-surface">
                  <div className="game-result-card">
                    <p className="game-result-title">WebGL2 required</p>
                    <p className="game-result-detail">
                      {glError}. Open this page in Chrome or Safari (not
                      Cursor's Simple Browser), and make sure hardware
                      acceleration is on.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {motionResult && motionOutcome === "photo-card" ? (
            <MotionWinReveal
              key={motionResult.resultId}
              photos={motionResult.photos}
              resultId={motionResult.resultId}
              onComplete={afterMotionResultPresentation}
            />
          ) : null}
          {motionResult && motionOutcome === "no-match" ? (
            <NoMatchOutcome
              key={motionResult.resultId}
              onComplete={afterMotionResultPresentation}
            />
          ) : null}
          {typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).has("debug") ? (
            <DebugHud />
          ) : null}
          {!entryReady ? (
            <div
              className="match-audio-gate"
              role="button"
              tabIndex={0}
              aria-label="Tap to play"
              onClick={onMatchEntryTap}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onMatchEntryTap();
                }
              }}
            >
              <span className="match-audio-gate-label">Tap to play</span>
            </div>
          ) : null}
          {introCover ? (
            <div
              className={`photo-scratch-intro-video${introLeaving ? " is-leaving" : ""}`}
              aria-hidden="true"
            >
              <div className="photo-scratch-intro-media">
                {introActive && introVideoUrl ? (
                  <video
                    ref={introVideoElRef}
                    autoPlay
                    muted={introMuted}
                    playsInline
                    preload="auto"
                    src={introVideoUrl}
                    onEnded={() => dismissThemeIntro()}
                    onError={() => dismissThemeIntro({ immediate: true })}
                  />
                ) : null}
                <canvas
                  ref={introFreezeCanvasRef}
                  className={`photo-scratch-intro-freeze${introActive ? "" : " is-visible"}`}
                />
              </div>
              <div className="photo-scratch-intro-flash" />
              <div className="photo-scratch-intro-ring" />
            </div>
          ) : null}
          {/* Top chrome — two rows:
                row 1: pause | icon-bar track | mute
                row 2: blank | progress toast slot | cards left
              Body-match bar is stage-absolute (center foil → dock fly). */}
          <div
            className={`stage-game__top-chrome${
              topBarPhase === "docked" ? " is-docked" : ""
            }`}
          >
            <div className="stage-game__top-chrome-row is-controls">
              <div className="stage-game__top-chrome-side is-start">
                {onLeave ? <GamePauseButton onLeave={onLeave} /> : null}
              </div>
              <div className="stage-game__top-chrome-center">
                {!useBodySymbols && !skipToPlay && matchStartUnlocked ? (
                  /* Legacy foil path: always 6 top slots (never body 12). */
                  <div
                    className={`symbol-bar${
                      revealedSymbols >= TOP_SYMBOL_COUNT
                        ? " is-symbols-complete"
                        : ""
                    }${claimed ? " is-fully-revealed" : ""}`}
                    aria-label="Game symbols"
                  >
                    {topSymbols
                      .slice(0, TOP_SYMBOL_COUNT)
                      .map((typeId, index) => (
                        <div
                          key={index}
                          ref={(el) => {
                            symbolSlotRefs.current[index] = el;
                          }}
                          className={`symbol-slot${
                            litSymbolSlots[index] ? " is-revealed" : ""
                          }`}
                          title={
                            litSymbolSlots[index]
                              ? SYMBOL_TYPES[typeId]?.label
                              : undefined
                          }
                        >
                          {litSymbolSlots[index] ? (
                            <GameSymbolIcon typeId={typeId} pixelScale={1.2} />
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
              <div className="stage-game__top-chrome-side is-end">
                <StageMuteButton />
              </div>
            </div>
            {/* Status row: [ cards-left 1fr | notifications 2fr ] */}
            <div className="stage-game__top-chrome-row is-status">
              <div className="stage-game__top-chrome-status-cards">
                {packProgressShown &&
                (skipToPlay ||
                  (modelCards.length > 1 &&
                    completedCardIds.length < modelCards.length &&
                    hasPlayableCard)) ? (
                  <div
                    className={[
                      "pack-progress-shell",
                      packProgressLeaving ? "is-leaving" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onAnimationEnd={() => {
                      if (!packProgressLeaving) return;
                      setPackProgressShown(false);
                      setPackProgressLeaving(false);
                    }}
                  >
                    {skipToPlay ? (
                      /* Lab always shows pack-progress for layout. */
                      <PackProgress current={1} total={5} />
                    ) : (
                      <PackProgress
                        current={
                          motionResult?.current ??
                          Math.min(
                            completedCardIds.length + 1,
                            modelCards.length,
                          )
                        }
                        total={modelCards.length}
                      />
                    )}
                  </div>
                ) : null}
              </div>
              <div
                className="stage-game__top-chrome-status-notes"
                data-progress-toast-slot="1"
              />
            </div>
          </div>
          {/* One TopSymbolBar for the whole match sequence:
              center (scratch foil) → docked (fly to top) → showcase. */}
          {(useBodySymbols || skipToPlay) &&
          (topChromeBarReady ||
            (matchStartUnlocked && topBarPhase !== "docked") ||
            (skipToPlay && topBarPhase === "center")) ? (
            <TopSymbolBar
              symbols={topSymbols}
              phase={topBarPhase}
              roundKey={topBarRound}
              matchedSlots={litTopSlots}
              slotElsOutRef={topBarSlotElsRef}
              forceRevealed={
                skipToPlay ? labTopBarForceRevealed : false
              }
              onAllRevealed={onTopBarAllRevealed}
              freezeSymbols={shouldFreezeSymbolLottie({
                basePaused: false,
                coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
                isScratching,
              })}
              preferStaticSymbols={shouldPreferStaticSymbolLottie({
                coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
              })}
              quietDecorativeLottie={shouldPreferStaticSymbolLottie({
                coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
              })}
            />
          ) : null}
          {skipToPlay ? (
            <TopBarSequenceLabPanel
              phase={topBarPhase}
              forceRevealed={labTopBarForceRevealed}
              onShowFoilScratch={labShowFoilScratchBar}
              onPlayDockToTop={labPlayDockToTop}
              onResetHunt={labResetTopBarHunt}
            />
          ) : null}
          <ScratchFrameProgress
            active={frameProgressActive}
            found={revealedSymbols}
            total={SYMBOL_SLOT_COUNT}
            batches={frameDiscoveryBatches}
            settling={frameSettling}
          />

          {/* Bottom HUD: [ coin count | Sugar Scratch logo ]. Badge idle-hides. */}
          <div className="stage-game__bottom-chrome">
            <div className="stage-game__bottom-chrome-row is-status">
              <div className="stage-game__bottom-chrome-status-cards">
                {coinBadgeShown ? (
                  <div
                    key={coinBadgeEnterKey}
                    className={[
                      "stage-game__cards-left",
                      "pack-progress-shell",
                      "pack-progress-shell--bottom-left",
                      coinBadgeLeaving ? "is-leaving" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onAnimationEnd={onCoinBadgeLeaveEnd}
                  >
                    <StageCoinCount
                      sessionDelta={sparkleDelta}
                      popNonce={coinPopNonce}
                    />
                  </div>
                ) : null}
              </div>
              <div className="stage-game__bottom-chrome-brand" aria-hidden="true">
                <img
                  src="/svg/logoSugarScratch.svg"
                  alt=""
                  className="stage-game__bottom-chrome-logo"
                  draggable={false}
                  decoding="async"
                />
              </div>
            </div>
          </div>
          {showIntroCountdown ? (
            <InitialCountdown
              onComplete={onIntroCountdownComplete}
              soundEnabled={soundEnabled}
            />
          ) : null}
          {useBodySymbols
            ? sessionSymbols.map((typeId, index) => (
                <div
                  key={`body-symbol-${index}`}
                  ref={(el) => {
                    bodyMarkerRefs.current[index] = el;
                  }}
                  className={`body-symbol-marker${
                    bodyRevealed[index] && !bodyFindHits[index]
                      ? " is-missed"
                      : ""
                  }`}
                  style={{ display: "none" }}
                >
                  {/* Matches unmount immediately — the flying coin owns the only
                      Lottie copy, then the top-bar slot keeps it. Misses stay. */}
                  {bodyRevealed[index] && !bodyFindHits[index] ? (
                    <span className="body-symbol-icon">
                      <GameSymbolIcon
                        typeId={typeId}
                        size={BODY_SYMBOL_ICON_PX}
                        pixelScale={1.2}
                        preferStatic={shouldPreferStaticSymbolLottie({
                          coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
                        })}
                        paused
                      />
                    </span>
                  ) : null}
                </div>
              ))
            : null}
          {useBodySymbols ? (
            <div
              ref={huntPulsarRef}
              className="hunt-hint-pulsar"
              aria-hidden="true"
            >
              <span className="hunt-hint-pulsar-ring" />
              <span className="hunt-hint-pulsar-ring hunt-hint-pulsar-ring--delay" />
              <span className="hunt-hint-pulsar-core" />
            </div>
          ) : null}
          {!useBodySymbols
            ? flyingCoins.map((coin) => (
                <div
                  key={coin.id}
                  className="flying-coin"
                  style={
                    {
                      "--coin-from-x": `${coin.fromX}px`,
                      "--coin-from-y": `${coin.fromY}px`,
                      "--coin-mid-x": `${coin.midX ?? coin.fromX}px`,
                      "--coin-mid-y": `${coin.midY ?? coin.fromY}px`,
                      "--coin-to-x": `${coin.toX}px`,
                      "--coin-to-y": `${coin.toY}px`,
                      animationDuration: `${COIN_FLIGHT_DURATION_MS}ms`,
                      animationDelay: `${coin.delayMs}ms`,
                    } as CSSProperties
                  }
                  onAnimationEnd={() => removeFlyingCoin(coin.id)}
                  aria-hidden="true"
                >
                  <GameSymbolIcon
                    typeId={coin.typeId}
                    pixelScale={1.15}
                    preferStatic={shouldPreferStaticSymbolLottie({
                      coarsePointer: CURSOR_FX_DEVICE.coarsePointer,
                    })}
                  />
                </div>
              ))
            : flyingCoins.map((coin) => (
                <MatchFlight
                  key={coin.id}
                  typeId={coin.typeId}
                  fromX={coin.fromX}
                  fromY={coin.fromY}
                  toX={coin.toX}
                  toY={coin.toY}
                  delayMs={coin.delayMs}
                  onArrive={() => removeFlyingCoin(coin.id)}
                />
              ))}
          <video
            ref={bottomVideoRef}
            className="source-video"
            muted
            loop
            playsInline
            preload="auto"
          />
          <video
            ref={foregroundVideoRef}
            className="source-video"
            muted
            loop
            playsInline
            preload="auto"
          />
          <canvas
            ref={canvasRef}
            className="game-stage-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={
              cardTransition || packRevealFailed
                ? { pointerEvents: "none" }
                : undefined
            }
            onPointerDown={(event) => {
              if (cardTransitionActiveRef.current) return;
              huntHintActivityAtRef.current = performance.now();
              if (soundEnabledRef.current)
                ensureSymbolAudio(symbolAudioRef.current);
              const bottomVideo = bottomVideoRef.current;
              const foregroundVideo = foregroundVideoRef.current;
              if (bottomVideo?.paused)
                void bottomVideo.play().catch(() => undefined);
              if (!fgParkedRef.current && foregroundVideo?.paused)
                void foregroundVideo.play().catch(() => undefined);
              drawingRef.current = true;
              isScratchingRef.current = true;
              setIsScratching(true);
              // Scrubbing again: bring coin badge back if it idle-hid.
              showCoinBadge();
              // First scratch touch: animate cards-left away for this card.
              if (packProgressShown && !packProgressLeaving) {
                setPackProgressLeaving(true);
              }
              lastScratchWorldRef.current = null;
              clearPendingScratchMove(scratchInputCoalesceRef.current);
              lastPointerClientRef.current = {
                x: event.clientX,
                y: event.clientY,
              };
              const point = getCanvasPoint(event.clientX, event.clientY);
              hoverPointRef.current = point;
              event.currentTarget.setPointerCapture(event.pointerId);
              if (point) applyScratchZoom(point);
              addScratch(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              lastPointerClientRef.current = {
                x: event.clientX,
                y: event.clientY,
              };
              hoverPointRef.current = getCanvasPoint(
                event.clientX,
                event.clientY,
              );
              if (!drawingRef.current) return;
              // Coalesce to one densified apply per rAF (Phase 7).
              notePendingScratchMove(
                scratchInputCoalesceRef.current,
                event.clientX,
                event.clientY,
              );
            }}
            onPointerUp={() => {
              endScratchStroke();
              clearScratchZoom();
            }}
            onPointerLeave={() => {
              endScratchStroke();
              hoverPointRef.current = null;
              clearScratchZoom();
            }}
            onPointerCancel={() => {
              endScratchStroke();
              hoverPointRef.current = null;
              clearScratchZoom();
            }}
          />
          {packRevealFailed && gameSession?.packScratch ? (
            <div
              className="game-result game-result--static"
              role="alert"
              style={{ pointerEvents: "auto" }}
            >
              <div className="game-result-iris">
                <div className="game-result-surface">
                  <div className="game-result-card">
                    <p className="game-result-title">Reveal interrupted</p>
                    <p className="game-result-detail">
                      Your match is saved. Retry the reveal when you are back
                      online.
                    </p>
                    <button
                      type="button"
                      className="game-result-button"
                      disabled={packRevealRetrying}
                      onClick={() => void retryPackReveal()}
                    >
                      {packRevealRetrying ? "Retrying…" : "Retry reveal"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {cardTransition ? (
            <MirrorSlideTransition
              fromSrc={cardTransition.fromBottom}
              toSrc={cardTransition.toForeground}
              templateId={cardTransition.templateId}
              holdUntilReady
              blendOut={cardTransitionReady}
              onComplete={() => void beginCardTransitionHandoff(cardTransition)}
              onError={() => void beginCardTransitionHandoff(cardTransition)}
            />
          ) : null}
          <div className="mobile-sound-wrap">
            <button
              type="button"
              className={`mobile-reset mobile-sound-toggle${soundEnabled ? "" : " is-muted"}`}
              aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
              aria-pressed={soundEnabled}
              onClick={() => updateSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (
                <Volume2 aria-hidden="true" size={20} strokeWidth={2.2} />
              ) : (
                <VolumeX aria-hidden="true" size={20} strokeWidth={2.2} />
              )}
            </button>
          </div>
          {/* Phones hide the dev panel, so surface compact controls on the stage
              itself. Hidden on desktop where the panel is used. */}
          <div className="mobile-controls-wrap">
            <button
              type="button"
              className={`mobile-reset mobile-controls-toggle${mobileControlsOpen ? " is-open" : ""}`}
              aria-label={
                mobileControlsOpen ? "Hide controls" : "Show controls"
              }
              aria-expanded={mobileControlsOpen}
              onClick={() => {
                setMobileControlsOpen((current) => {
                  if (current) setMobileSettingsOpen(false);
                  return !current;
                });
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {mobileControlsOpen && (
              <div className="mobile-controls">
                {gameMode ? (
                  <a
                    className="mobile-reset mobile-game-link"
                    href="/collection"
                  >
                    Game
                  </a>
                ) : null}
                <label className="mobile-card-switch">
                  <span className="visually-hidden">Card</span>
                  <select
                    aria-label="Card clip"
                    onChange={(event) =>
                      setSelectedCardId(event.currentTarget.value)
                    }
                    value={card.id}
                  >
                    {remainingCards.map((entry, index) => (
                      <option key={entry.id} value={entry.id}>
                        {index + 1}. {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="mobile-reset"
                  aria-label="Reset scratch"
                  onClick={resetScratch}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`mobile-reset${autoScratch.enabled ? " is-active" : ""}${symbolsHuntComplete ? " is-symbols-complete" : ""}`}
                  disabled={autoScratchLocked}
                  aria-label={
                    autoScratchLocked
                      ? `Find all ${SYMBOL_SLOT_COUNT} matches first`
                      : autoScratch.enabled
                        ? "Auto scratch running"
                        : "Enable auto scratch"
                  }
                  aria-pressed={autoScratch.enabled}
                  onClick={() =>
                    updateAutoScratch({ enabled: !autoScratch.enabled })
                  }
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="mobile-reset mobile-settings-toggle"
                  aria-label="Animation settings"
                  aria-expanded={mobileSettingsOpen}
                  onClick={() => setMobileSettingsOpen((current) => !current)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            )}
            {mobileControlsOpen && mobileSettingsOpen && (
              <div
                className="mobile-settings-sheet"
                role="dialog"
                aria-label="Animation settings"
              >
                {scratchZoomControls}
                {autoScratchControls}
                {cursorFxControls}
              </div>
            )}
          </div>
        </div>
        <aside className="panel">
          <div>
            <p className="eyebrow">
              {gameMode
                ? "GAME · motion hand"
                : (activeModel?.label ?? "Sugar Scratchie")}
            </p>
            <h1>{card.label}</h1>
            <p className="eyebrow">
              Left {remainingCards.length}/{modelCards.length}
              {completedCardIds.length > 0
                ? ` · scratched ${completedCardIds.length}`
                : ""}
              {gameMode && gameSession
                ? ` · photos banked ${gameSession.photoPrizeTotal}`
                : ""}
            </p>
          </div>
          <div className="button-row">
            {gameMode ? (
              <a className="secondary-button" href="/collection">
                Game
              </a>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setActiveModelId("");
                  setSelectedCardId("");
                  setCompletedCardIds([]);
                  completedCardIdsRef.current = [];
                }}
              >
                Girls
              </button>
            )}
            <a className="secondary-button" href="/dashboard/models">
              Models
            </a>
          </div>
          <label>
            Card
            <select
              aria-label="Card clip"
              onChange={(event) => setSelectedCardId(event.currentTarget.value)}
              value={card.id}
            >
              {remainingCards.map((entry, index) => (
                <option key={entry.id} value={entry.id}>
                  {index + 1}. {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mesh
            <select
              aria-label="Mesh keyframe JSON"
              disabled={meshFiles.length === 0}
              onChange={(event) =>
                setSelectedMeshFile(event.currentTarget.value)
              }
              value={selectedMeshFile}
            >
              {meshFiles.length === 0 ? (
                <option value="">No mesh JSON files</option>
              ) : (
                meshFiles.map((file) => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="timeline-controls">
            <input
              aria-label="Video timeline"
              max={duration || 0}
              min={0}
              onChange={(event) =>
                setVideoTime(Number(event.currentTarget.value))
              }
              step={0.05}
              type="range"
              value={Math.min(currentTime, duration || currentTime)}
            />
          </div>
          <div className="button-row">
            <button type="button" onClick={togglePlayback}>
              {isPaused ? "Play video" : "Pause video"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetScratch}
            >
              Reset scratch
            </button>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowMesh((current) => !current)}
            >
              {showMesh ? "Hide mesh" : "Show mesh"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setMeshReloadToken((current) => current + 1)}
            >
              Reload mesh
            </button>
          </div>
          {desktopSettingsTabs}
        </aside>
      </section>
    </main>
  );
}

type TopBarSequenceLabPanelProps = {
  phase: TopBarPhase;
  forceRevealed: boolean;
  onShowFoilScratch: () => void;
  onPlayDockToTop: () => void;
  onResetHunt: () => void;
};

/** /game-ui only — step the foil scratch → dock sequence. */
function TopBarSequenceLabPanel({
  phase,
  forceRevealed,
  onShowFoilScratch,
  onPlayDockToTop,
  onResetHunt,
}: TopBarSequenceLabPanelProps) {
  const [open, setOpen] = useState(true);

  if (typeof document === "undefined") return null;

  const modeLabel =
    phase === "center" && !forceRevealed
      ? "foil scratch"
      : phase === "center" && forceRevealed
        ? "center (pre-dock)"
        : phase === "docked"
          ? "docked top"
          : phase;

  return createPortal(
    <aside
      className={["home-hero-debug", "home-hero-debug--center", open ? "" : "is-collapsed"]
        .filter(Boolean)
        .join(" ")}
      aria-label="Top bar sequence lab"
    >
      <div className="home-hero-debug__head">
        <p className="home-hero-debug__title">Top bar sequence</p>
        <div className="home-hero-debug__actions">
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {open ? (
        <div className="home-hero-debug__body">
          <p className="home-hero-debug__hint">
            Iterate foil scratch → dock without running the full intro. Phase:{" "}
            <strong>{modeLabel}</strong>
          </p>
          <div className="home-hero-debug__section">
            <p className="home-hero-debug__section-title">Reveal icons</p>
            <div className="home-hero-debug__actions" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="home-hero-debug__btn"
                onClick={onShowFoilScratch}
              >
                Show foil scratch bar
              </button>
            </div>
            <p className="home-hero-debug__hint">
              Centers the bar with foil coating. Scratch the icons, then it
              auto-docks after clear.
            </p>
          </div>
          <div className="home-hero-debug__section">
            <p className="home-hero-debug__section-title">Dock flight</p>
            <div className="home-hero-debug__actions" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="home-hero-debug__btn"
                onClick={onPlayDockToTop}
              >
                Play dock to top
              </button>
              <button
                type="button"
                className="home-hero-debug__btn"
                onClick={onResetHunt}
              >
                Reset docked hunt
              </button>
            </div>
            <p className="home-hero-debug__hint">
              Replays the bar flying from center into the top chrome (icons
              already revealed).
            </p>
          </div>
        </div>
      ) : null}
    </aside>,
    document.body,
  );
}
