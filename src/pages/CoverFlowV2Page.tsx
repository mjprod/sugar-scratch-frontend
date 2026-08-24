import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, type PanInfo } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { CoverFlowCarouselV2 } from "@/features/packs/CoverFlowCarouselV2";
import {
  getCardTopDebug,
  setCardTopDebug,
  setCardTopLottieOffset,
  setCardTopTearT,
  setPackOpenRequested,
  setSelectedTearKeyId,
  subscribeCardTopDebug,
  type CardTopDebugState,
} from "@/features/packs/cardTopDebug";
import {
  CARD_TOP_TEAR_FINISH_MS,
  cardTopTearSpinStartT,
  cardTopTearSliderEndT,
  loadCardTopTearTimeline,
  sampleCardTopTear,
  saveCardTopTearTimeline,
  sliderPercentFromTearT,
  tearTFromSliderPercent,
  type CardTopTearPose,
  type CardTopTearTimeline,
} from "@/features/packs/cardTopTearTimeline";
import { packItemToIteration, type Iteration } from "@/features/packs/types";
import "@/features/packs/packs.css";
import { useAuth } from "@/contexts/AuthContext";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  diamondCostForPackId,
  fetchHomepage,
  type FeaturedPack,
} from "@/services/homepage";
import {
  loadModels,
  profileFromModel,
  type BackendModel,
} from "@/services/models";

const DEFAULT_GLOW = "oklch(0.798 0.104 207.84)";
const MAX_PACKS = 10;
const PACK_MODEL_URL_V2 = "/assets/CardPack2-min.glb";

type CoverFlowCatalog = {
  items: Iteration[];
  playById: Map<
    string,
    {
      id: string;
      name: string;
      creatorName: string;
      diamondCost: number;
    }
  >;
};

function iterationsFromModels(models: BackendModel[]): CoverFlowCatalog {
  const items: Iteration[] = [];
  const playById = new Map<
    string,
    { id: string; name: string; creatorName: string; diamondCost: number }
  >();

  for (const model of models) {
    const profile = profileFromModel(model);
    for (const foil of profile.packs) {
      if (items.length >= MAX_PACKS) {
        return { items, playById };
      }
      const diamondCost = diamondCostForPackId(profile.id);
      items.push(
        packItemToIteration({
          id: foil.id,
          characterId: profile.id,
          name: profile.name,
          modelUrl: PACK_MODEL_URL_V2,
          modelName: "CardPack2-min.glb",
          videoUrl: foil.videoUrl,
          price: diamondCost,
          girlName: profile.name,
          packNumber: foil.slot === 1 ? 101 : 102,
          packName: foil.label,
          flagEmoji: profile.flagEmoji ?? "",
          backgroundColor: profile.overlayColorEnd ?? DEFAULT_GLOW,
        }),
      );
      playById.set(foil.id, {
        id: profile.id,
        name: foil.label || profile.name,
        creatorName: profile.name,
        diamondCost,
      });
    }
  }

  return { items, playById };
}

function formatDebugNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function CardTopDebugField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  digits,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  digits?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="home-hero-debug__field">
      <span>
        {label}
        <em>
          {formatDebugNumber(value, digits)}
          {suffix}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const TEAR_DRAG_DISTANCE_PX = 180;

function useCoverflowTearSlider() {
  const [debug, setDebug] = useState<CardTopDebugState>(getCardTopDebug);
  const [timeline, setTimeline] = useState<CardTopTearTimeline>(
    loadCardTopTearTimeline,
  );
  const [finishing, setFinishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const finishStartedRef = useRef(false);
  const sliderEndT = cardTopTearSliderEndT(timeline);
  const sliderPercent = sliderPercentFromTearT(debug.tearT, timeline);

  useEffect(() => subscribeCardTopDebug(setDebug), []);

  function applyPoseToPack(pose: CardTopTearPose, extra?: Partial<CardTopDebugState>) {
    setCardTopDebug({
      ...extra,
      position: { x: pose.x, y: pose.y, z: pose.z },
      rotation: { x: pose.rotX, y: pose.rotY, z: pose.rotZ },
      scale: { x: pose.scaleX, y: pose.scaleY, z: pose.scaleZ },
      opacity: pose.opacity,
    });
  }

  function persistTimeline(next: CardTopTearTimeline, pose?: CardTopTearPose) {
    saveCardTopTearTimeline(next);
    setTimeline(next);
    if (pose) applyPoseToPack(pose);
  }

  function applyTearT(tearT: number, playing = false) {
    const pose = sampleCardTopTear(timeline, tearT);
    setSelectedTearKeyId(null);
    setCardTopTearT(tearT, playing);
    applyPoseToPack(pose);
    setPackOpenRequested(tearT >= cardTopTearSpinStartT(timeline) - 0.001);
  }

  function startFinish() {
    finishStartedRef.current = true;
    setClosing(false);
    setFinishing(true);
    applyTearT(sliderEndT, true);
  }

  function startClose() {
    if (closing || finishing || debug.tearT <= 0.001) return;
    finishStartedRef.current = false;
    setFinishing(false);
    setClosing(true);
    applyTearT(debug.tearT, true);
  }

  function replayTear() {
    finishStartedRef.current = false;
    setFinishing(false);
    setClosing(false);
    applyTearT(0, false);
  }

  function scrubSlider(percent: number, options?: { snapClosed?: boolean }) {
    finishStartedRef.current = false;
    setFinishing(false);
    setClosing(false);
    const nextPercent = Math.min(100, Math.max(0, percent));
    applyTearT(tearTFromSliderPercent(nextPercent, timeline), false);
    if (nextPercent >= 100) startFinish();
    else if (options?.snapClosed) startClose();
  }

  useEffect(() => {
    if (!debug.tearPlaying && !finishing && !closing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const state = getCardTopDebug();
      if (!state.tearPlaying && !finishing && !closing) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (closing) {
        const next = state.tearT - dt / 0.28;
        if (next <= 0) {
          applyTearT(0, false);
          setClosing(false);
          return;
        }
        applyTearT(next, true);
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const duration = finishing
        ? CARD_TOP_TEAR_FINISH_MS
        : CARD_TOP_TEAR_FINISH_MS + sliderEndT * 1000;
      const span = finishing ? 1 - sliderEndT : sliderEndT;
      const next = state.tearT + (dt / (duration / 1000)) * span;
      const cap = finishing ? 1 : sliderEndT;
      if (next >= cap) {
        applyTearT(cap, false);
        if (finishing) setFinishing(false);
        return;
      }
      applyTearT(next, true);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [closing, debug.tearPlaying, finishing, sliderEndT, timeline]);

  return {
    debug,
    timeline,
    finishing,
    finishStartedRef,
    sliderEndT,
    sliderPercent,
    applyPoseToPack,
    persistTimeline,
    applyTearT,
    startFinish,
    scrubSlider,
    replayTear,
    setFinishing,
  };
}

function DragToTearControl({
  percent,
  finishing,
  onScrub,
}: {
  percent: number;
  finishing: boolean;
  onScrub: (percent: number, options?: { snapClosed?: boolean }) => void;
}) {
  const originPercentRef = useRef(percent);
  const torn = finishing || percent >= 100;
  const boxOpacity = torn ? 0 : 1 - Math.min(100, Math.max(0, percent)) / 100;

  return (
    <div className="pointer-events-none flex justify-center">
      <motion.button
        type="button"
        data-tutorial-target="tear"
        aria-label="Drag to tear"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        animate={{ opacity: boxOpacity, x: 0 }}
        transition={{ duration: torn ? 0.2 : 0 }}
        style={{ pointerEvents: torn ? "none" : "auto", x: 0 }}
        onDragStart={() => {
          originPercentRef.current = percent;
        }}
        onDrag={(_, info: PanInfo) => {
          const next = originPercentRef.current + (info.offset.x / TEAR_DRAG_DISTANCE_PX) * 100;
          onScrub(next);
        }}
        onDragEnd={(_, info: PanInfo) => {
          const next = originPercentRef.current + (info.offset.x / TEAR_DRAG_DISTANCE_PX) * 100;
          onScrub(next, { snapClosed: true });
        }}
        className="pointer-events-auto flex h-[6.3rem] w-[28rem] cursor-ew-resize items-center justify-center overflow-hidden bg-transparent p-0"
      >
        <DotLottieReact
          src="/lottie/iconSwipe.lottie"
          autoplay
          loop
          speed={1}
          renderConfig={{
            devicePixelRatio:
              typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            autoResize: true,
          }}
          style={{ width: 288, height: 288 }}
        />
      </motion.button>
    </div>
  );
}

function TearLottieDebugPanel({ onReplay }: { onReplay: () => void }) {
  const [debug, setDebug] = useState<CardTopDebugState>(getCardTopDebug);
  const [open, setOpen] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy");

  useEffect(() => subscribeCardTopDebug(setDebug), []);

  async function copyOffset() {
    const snippet = [
      `lottieOffset.x: ${debug.lottieOffset.x},`,
      `lottieOffset.y: ${debug.lottieOffset.y},`,
      `lottieOffset.z: ${debug.lottieOffset.z},`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    window.setTimeout(() => setCopyLabel("Copy"), 1600);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <aside
      className={["home-hero-debug", open ? "" : "is-collapsed"]
        .filter(Boolean)
        .join(" ")}
      aria-label="Tear lottie position"
    >
      <div className="home-hero-debug__head">
        <p className="home-hero-debug__title">Tear lottie</p>
        <div className="home-hero-debug__actions">
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={onReplay}
          >
            Replay
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() =>
              setCardTopLottieOffset({ x: -0.97, y: 2.26, z: -1.92 })
            }
          >
            Reset
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => void copyOffset()}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div className="home-hero-debug__body">
        <div className="home-hero-debug__section">
          <p className="home-hero-debug__section-title">Position</p>
          <CardTopDebugField
            label="X"
            value={debug.lottieOffset.x}
            min={-2}
            max={2}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => setCardTopLottieOffset({ x: value })}
          />
          <CardTopDebugField
            label="Y"
            value={debug.lottieOffset.y}
            min={-2}
            max={5}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => setCardTopLottieOffset({ y: value })}
          />
          <CardTopDebugField
            label="Z"
            value={debug.lottieOffset.z}
            min={-2}
            max={2}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => setCardTopLottieOffset({ z: value })}
          />
        </div>
      </div>
    </aside>,
    document.body,
  );
}

function iterationsFromFeatured(packs: FeaturedPack[]): CoverFlowCatalog {
  const items: Iteration[] = [];
  const playById = new Map<
    string,
    { id: string; name: string; creatorName: string; diamondCost: number }
  >();

  for (const pack of packs) {
    items.push(
      packItemToIteration({
        id: pack.id,
        characterId: pack.creatorId,
        name: pack.creatorName,
        modelUrl: PACK_MODEL_URL_V2,
        modelName: "CardPack2-min.glb",
        videoUrl: "",
        price: pack.diamondCost,
        girlName: pack.creatorName,
        packNumber: 101,
        packName: pack.packTitle.replace(/\n/g, " "),
        flagEmoji: "",
        backgroundColor: pack.accentColors.primary,
      }),
    );
    playById.set(pack.id, {
      id: pack.id,
      name: pack.name,
      creatorName: pack.creatorName,
      diamondCost: pack.diamondCost,
    });
  }

  return { items, playById };
}

/** Isolated playground for the next 3D pack coverflow. Original home/purchase stages are untouched. */
export function CoverFlowV2Page() {
  const { openPurchase } = useAuth();
  const tear = useCoverflowTearSlider();
  const [catalog, setCatalog] = useState<CoverFlowCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glow, setGlow] = useState(DEFAULT_GLOW);

  useMarkPageReady(catalog !== null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadModels(), fetchHomepage()])
      .then(([models, homepage]) => {
        if (cancelled) return;
        const fromModels = iterationsFromModels(models);
        setCatalog(
          fromModels.items.length
            ? fromModels
            : iterationsFromFeatured(homepage.featured),
        );
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const homepage = await fetchHomepage();
          if (!cancelled) setCatalog(iterationsFromFeatured(homepage.featured));
        } catch {
          if (!cancelled) setCatalog({ items: [], playById: new Map() });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = catalog?.items ?? [];

  useEffect(() => {
    if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
      setGlow(items[0].backgroundColor || DEFAULT_GLOW);
    }
  }, [items, selectedId]);

  if (!catalog) {
    return (
      <section
        className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
        aria-label="Coverflow v2"
      >
        <TearLottieDebugPanel onReplay={tear.replayTear} />
      </section>
    );
  }

  return (
    <section
      className="absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[oklch(0.14_0_0)]"
      aria-label="Coverflow v2"
    >
      <div
        className="stage-packs"
        style={{ ["--overlay-gradient-color-end" as string]: glow }}
      >
        <div
          className="packs-glow-stack packs-glow-stack--base"
          aria-hidden="true"
        >
          <div className="packs-circle packs-circle--bloom" />
          <div className="packs-circle packs-circle--core" />
        </div>
        <CoverFlowCarouselV2
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDeselect={() => setSelectedId(null)}
          onFocusChange={(item) => {
            setGlow(item?.backgroundColor || DEFAULT_GLOW);
          }}
          formatPrice={(price) => String(price)}
          onBuy={(item) => {
            const target = catalog.playById.get(item.id);
            if (!target) return;
            openPurchase(
              {
                packId: target.id,
                packName: target.name,
                price: String(target.diamondCost),
                creator: target.creatorName,
              },
              "buy-pack",
            );
          }}
          tearHud={
            <DragToTearControl
              percent={tear.sliderPercent}
              finishing={tear.finishing}
              onScrub={tear.scrubSlider}
            />
          }
        />
      </div>
      <TearLottieDebugPanel onReplay={tear.replayTear} />
    </section>
  );
}
