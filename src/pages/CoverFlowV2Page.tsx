import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CoverFlowCarouselV2,
  DEFAULT_COVERFLOW_CAMERA,
  MOBILE_COVERFLOW_CAMERA,
  type CoverFlowCameraSettings,
} from "@/features/packs/CoverFlowCarouselV2";
import { DragToTearControl } from "@/features/packs/DragToTearControl";
import { useCoverflowTearSlider } from "@/features/packs/useCoverflowTearSlider";
import {
  getCardTopDebug,
  setCardTopLottieOffset,
  subscribeCardTopDebug,
  type CardTopDebugState,
} from "@/features/packs/cardTopDebug";
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
const COVERFLOW_MOBILE_QUERY = "(max-width: 980px)";
const CENTER_DEBUG_STORAGE_KEY = "sugar.coverflowV2.centerDebug.v2";
/** Flip off when horizontal centering is locked in. */
const CENTER_DEBUG_ENABLED = false;

type CenterDebugState = {
  cameraX: number;
  packsX: number;
  cameraY: number;
  packsY: number;
  modelY: number;
  cameraZ: number;
  lookAtY: number;
  fov: number;
};

function isMobileCoverflowViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(COVERFLOW_MOBILE_QUERY).matches
  );
}

function defaultCenterDebug(isMobile: boolean): CenterDebugState {
  const camera = isMobile ? MOBILE_COVERFLOW_CAMERA : DEFAULT_COVERFLOW_CAMERA;
  return {
    cameraX: camera.cameraX,
    packsX: camera.packsX,
    cameraY: camera.cameraY,
    packsY: camera.packsY,
    modelY: camera.modelY,
    cameraZ: camera.cameraZ,
    lookAtY: camera.lookAtY,
    fov: camera.fov,
  };
}

function loadCenterDebug(isMobile: boolean): CenterDebugState {
  const fallback = defaultCenterDebug(isMobile);
  if (!CENTER_DEBUG_ENABLED || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(CENTER_DEBUG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CenterDebugState>;
    const next = { ...fallback };
    (Object.keys(fallback) as Array<keyof CenterDebugState>).forEach((key) => {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value)) next[key] = value;
    });
    return next;
  } catch {
    return fallback;
  }
}

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
          flagSvgUrl: profile.flagSvgUrl ?? "",
          city: profile.city ?? "",
          country: profile.country ?? "",
          overlayColorStart: profile.overlayColorStart ?? DEFAULT_GLOW,
          overlayColorEnd: profile.overlayColorEnd ?? DEFAULT_GLOW,
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

function CoverflowCenterDebugPanel({
  debug,
  open,
  isMobile,
  onChange,
  onOpenChange,
}: {
  debug: CenterDebugState;
  open: boolean;
  isMobile: boolean;
  onChange: (next: CenterDebugState) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy");

  function update<K extends keyof CenterDebugState>(
    key: K,
    value: CenterDebugState[K],
  ) {
    onChange({ ...debug, [key]: value });
  }

  async function copyDebug() {
    const snippet = [
      `cameraX: ${debug.cameraX},`,
      `packsX: ${debug.packsX},`,
      `cameraY: ${debug.cameraY},`,
      `packsY: ${debug.packsY},`,
      `modelY: ${debug.modelY},`,
      `cameraZ: ${debug.cameraZ},`,
      `lookAtY: ${debug.lookAtY},`,
      `fov: ${debug.fov},`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    window.setTimeout(() => setCopyLabel("Copy"), 1600);
  }

  if (!CENTER_DEBUG_ENABLED || typeof document === "undefined") return null;

  return createPortal(
    <aside
      className={[
        "home-hero-debug",
        "home-hero-debug--center",
        open ? "" : "is-collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Coverflow center debug"
    >
      <div className="home-hero-debug__head">
        <p className="home-hero-debug__title">Coverflow center</p>
        <div className="home-hero-debug__actions">
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => onChange(defaultCenterDebug(isMobile))}
          >
            Reset
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => void copyDebug()}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => onOpenChange(!open)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div className="home-hero-debug__body">
        <div className="home-hero-debug__section">
          <p className="home-hero-debug__section-title">Horizontal center</p>
          <p className="home-hero-debug__hint">
            Green line = viewport center. Nudge Camera X / Packs X until the
            active pack sits on it.
          </p>
          <CardTopDebugField
            label="Camera X"
            value={debug.cameraX}
            min={-2}
            max={2}
            step={0.005}
            suffix=""
            digits={3}
            onChange={(value) => update("cameraX", value)}
          />
          <CardTopDebugField
            label="Packs X"
            value={debug.packsX}
            min={-2}
            max={2}
            step={0.005}
            suffix=""
            digits={3}
            onChange={(value) => update("packsX", value)}
          />
        </div>
        <div className="home-hero-debug__section">
          <p className="home-hero-debug__section-title">Vertical / depth</p>
          <CardTopDebugField
            label="Packs Y"
            value={debug.packsY}
            min={-3}
            max={1.5}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => update("packsY", value)}
          />
          <CardTopDebugField
            label="Model Y"
            value={debug.modelY}
            min={-2}
            max={1.5}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => update("modelY", value)}
          />
          <CardTopDebugField
            label="Camera Y"
            value={debug.cameraY}
            min={-1.5}
            max={2}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => update("cameraY", value)}
          />
          <CardTopDebugField
            label="Look at Y"
            value={debug.lookAtY}
            min={-1.5}
            max={1.5}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => update("lookAtY", value)}
          />
          <CardTopDebugField
            label="Camera Z"
            value={debug.cameraZ}
            min={3}
            max={10}
            step={0.05}
            suffix=""
            digits={2}
            onChange={(value) => update("cameraZ", value)}
          />
          <CardTopDebugField
            label="FOV"
            value={debug.fov}
            min={18}
            max={55}
            step={0.5}
            suffix="°"
            digits={1}
            onChange={(value) => update("fov", value)}
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
  const { addToCart } = useAuth();
  const tear = useCoverflowTearSlider();
  const [catalog, setCatalog] = useState<CoverFlowCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glow, setGlow] = useState(DEFAULT_GLOW);
  const [isMobileViewport, setIsMobileViewport] = useState(
    isMobileCoverflowViewport,
  );
  const [centerDebug, setCenterDebug] = useState<CenterDebugState>(() =>
    loadCenterDebug(isMobileCoverflowViewport()),
  );
  const [centerDebugOpen, setCenterDebugOpen] = useState(CENTER_DEBUG_ENABLED);

  useMarkPageReady(catalog !== null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(COVERFLOW_MOBILE_QUERY);
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!CENTER_DEBUG_ENABLED || typeof window === "undefined") return;
    window.localStorage.setItem(
      CENTER_DEBUG_STORAGE_KEY,
      JSON.stringify(centerDebug),
    );
  }, [centerDebug]);

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

  const cameraSettings = useMemo<CoverFlowCameraSettings>(() => {
    const base = isMobileViewport
      ? MOBILE_COVERFLOW_CAMERA
      : DEFAULT_COVERFLOW_CAMERA;
    return {
      ...base,
      cameraX: centerDebug.cameraX,
      packsX: centerDebug.packsX,
      cameraY: centerDebug.cameraY,
      packsY: centerDebug.packsY,
      modelY: centerDebug.modelY,
      cameraZ: centerDebug.cameraZ,
      lookAtY: centerDebug.lookAtY,
      fov: centerDebug.fov,
    };
  }, [centerDebug, isMobileViewport]);

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
        <CoverflowCenterDebugPanel
          debug={centerDebug}
          open={centerDebugOpen}
          isMobile={isMobileViewport}
          onChange={setCenterDebug}
          onOpenChange={setCenterDebugOpen}
        />
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
          cameraSettings={cameraSettings}
          revealModelId={
            (selectedId && catalog.playById.get(selectedId)?.id) ||
            items.find((item) => item.id === selectedId)?.characterId ||
            items[0]?.characterId ||
            null
          }
          revealGirlName={
            (selectedId && catalog.playById.get(selectedId)?.creatorName) ||
            items.find((item) => item.id === selectedId)?.girlName ||
            items[0]?.girlName ||
            null
          }
          revealOverlay={{
            city:
              items.find((item) => item.id === selectedId)?.city ||
              items[0]?.city ||
              "",
            country:
              items.find((item) => item.id === selectedId)?.country ||
              items[0]?.country ||
              "",
            flagEmoji:
              items.find((item) => item.id === selectedId)?.flagEmoji ||
              items[0]?.flagEmoji ||
              "",
            flagSvgUrl:
              items.find((item) => item.id === selectedId)?.flagSvgUrl ||
              items[0]?.flagSvgUrl ||
              "",
            gradientColor:
              items.find((item) => item.id === selectedId)?.overlayColorStart ||
              glow,
            gradientColorEnd:
              items.find((item) => item.id === selectedId)?.overlayColorEnd ||
              glow,
          }}
          onFocusChange={(item) => {
            setGlow(item?.backgroundColor || DEFAULT_GLOW);
          }}
          formatPrice={(price) => String(price)}
          onBuy={(item) => {
            const target = catalog.playById.get(item.id);
            if (!target) return;
            addToCart({
              packId: target.id,
              packName: target.name,
              creator: target.creatorName,
              characterId: target.id,
              price: target.diamondCost,
              videoUrl: item.videoUrl,
              packNumber: item.packNumber,
              flagEmoji: item.flagEmoji,
              flagSvgUrl: item.flagSvgUrl,
              city: item.city,
              country: item.country,
              overlayColorStart: item.overlayColorStart,
              overlayColorEnd: item.overlayColorEnd,
              backgroundColor: item.backgroundColor,
            });
          }}
          tearHud={
            <DragToTearControl
              percent={tear.sliderPercent}
              finishing={tear.finishing}
              onScrub={tear.scrubSlider}
            />
          }
        />
        {CENTER_DEBUG_ENABLED && centerDebugOpen ? (
          <div className="coverflow-center-guide" aria-hidden="true">
            <span className="coverflow-center-guide__line" />
            <span className="coverflow-center-guide__label">center</span>
          </div>
        ) : null}
      </div>
      <TearLottieDebugPanel onReplay={tear.replayTear} />
      <CoverflowCenterDebugPanel
        debug={centerDebug}
        open={centerDebugOpen}
        isMobile={isMobileViewport}
        onChange={setCenterDebug}
        onOpenChange={setCenterDebugOpen}
      />
    </section>
  );
}
