import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import {
  CoverFlowCarousel,
  DEFAULT_COVERFLOW_CAMERA,
  MOBILE_COVERFLOW_CAMERA,
  type CoverFlowCameraSettings,
} from "@/features/packs/CoverFlowCarousel";
import { packItemToIteration, type Iteration } from "@/features/packs/types";
import "@/features/packs/packs.css";
import {
  DEFAULT_VIDEO_TEXTURE_TRANSFORM,
  PACK_MODEL_URL,
  PACK_TEXTURE_SIZE,
  PACK_VIDEO_FIT_MODE,
  makeVideoTextureCacheKey,
  preloadVideoTexture,
  subscribeVideoTextureReady,
} from "@/lib/pack3d";
import {
  diamondCostForPackId,
  type FeaturedPack,
} from "@/services/homepage";
import { resolveCollectionThemeLabel } from "@/services/collection";
import { isPackInCart, subscribeCart } from "@/services/cart";
import {
  loadModels,
  profileFromModel,
  type BackendModel,
} from "@/services/models";

const DEFAULT_GLOW = "oklch(0.798 0.104 207.84)";
const MAX_HOME_PACKS = 10;
const HERO_DEBUG_STORAGE_KEY = "sugar.homeHeroDebug.v2";
const COVERFLOW_MOBILE_QUERY = "(max-width: 980px)";
/** Flip to true to restore the homepage hero placement sliders. */
const HERO_DEBUG_ENABLED = false;

type HeroDebugState = {
  headingX: number;
  headingY: number;
  packsX: number;
  packsY: number;
  modelY: number;
  cameraX: number;
  cameraY: number;
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

/** Desktop homepage hero — locked from center debug. */
const HOME_COVERFLOW_CAMERA: CoverFlowCameraSettings = {
  ...DEFAULT_COVERFLOW_CAMERA,
  packsX: 0.015,
  packsY: -1.25,
  modelY: -0.02,
  cameraX: 0.11,
  cameraY: 0.27,
  cameraZ: 5.9,
  lookAtY: 0.1,
  fov: 36,
};

function defaultHeroDebug(isMobile: boolean): HeroDebugState {
  const camera = isMobile ? MOBILE_COVERFLOW_CAMERA : HOME_COVERFLOW_CAMERA;
  return {
    headingX: 0,
    headingY: isMobile ? 5.25 : 7.1,
    packsX: camera.packsX,
    packsY: camera.packsY,
    modelY: camera.modelY,
    cameraX: camera.cameraX,
    cameraY: camera.cameraY,
    cameraZ: camera.cameraZ,
    lookAtY: camera.lookAtY,
    fov: camera.fov,
  };
}

function mergeHeroDebug(
  parsed: Partial<HeroDebugState> | null | undefined,
  fallback: HeroDebugState,
): HeroDebugState {
  const next = { ...fallback };
  if (!parsed) return next;
  (Object.keys(fallback) as Array<keyof HeroDebugState>).forEach((key) => {
    const value = parsed[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = value;
    }
  });
  return next;
}

function loadHeroDebug(isMobile: boolean): HeroDebugState {
  const fallback = defaultHeroDebug(isMobile);
  if (!HERO_DEBUG_ENABLED || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(HERO_DEBUG_STORAGE_KEY);
    if (!raw) return fallback;
    return mergeHeroDebug(JSON.parse(raw) as Partial<HeroDebugState>, fallback);
  } catch {
    return fallback;
  }
}

function formatDebugNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export type FeaturedCoverFlowPlayTarget = {
  id: string;
  foilId?: string;
  name: string;
  creatorName: string;
  diamondCost: number;
  themeName?: string;
};

type CoverFlowCatalog = {
  items: Iteration[];
  playById: Map<string, FeaturedCoverFlowPlayTarget>;
};

function iterationsFromModels(models: BackendModel[]): CoverFlowCatalog {
  const items: Iteration[] = [];
  const playById = new Map<string, FeaturedCoverFlowPlayTarget>();

  for (const model of models) {
    const profile = profileFromModel(model);
    for (const foil of profile.packs) {
      if (items.length >= MAX_HOME_PACKS) {
        return { items, playById };
      }
      const diamondCost = diamondCostForPackId(profile.id);
      items.push(
        packItemToIteration({
          id: foil.id,
          characterId: profile.id,
          name: profile.name,
          modelUrl: PACK_MODEL_URL,
          modelName: "card2.glb",
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
        foilId: foil.id,
        name: foil.label || profile.name,
        creatorName: profile.name,
        diamondCost,
        themeName:
          resolveCollectionThemeLabel({
            packName: foil.label,
            catalogPackId: foil.id,
            creator: profile.name,
          }) || undefined,
      });
    }
  }

  return { items, playById };
}

function iterationsFromFeatured(packs: FeaturedPack[]): CoverFlowCatalog {
  const items: Iteration[] = [];
  const playById = new Map<string, FeaturedCoverFlowPlayTarget>();

  for (const pack of packs) {
    items.push(
      packItemToIteration({
        id: pack.id,
        characterId: pack.creatorId,
        name: pack.creatorName,
        modelUrl: PACK_MODEL_URL,
        modelName: "card2.glb",
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
      themeName: pack.themeName,
    });
  }

  return { items, playById };
}

function HeroDebugField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="home-hero-debug__field">
      <span>
        {label}
        <em>{formatDebugNumber(value)}</em>
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

/**
 * Homepage hero — same Three.js cover-flow used on purchase choose-pack.
 */
export function FeaturedCoverFlow({
  featured,
  onPlay,
  onReady,
}: {
  featured: FeaturedPack[];
  onPlay: (pack: FeaturedCoverFlowPlayTarget) => void;
  onReady?: () => void;
}) {
  const [catalog, setCatalog] = useState<CoverFlowCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glow, setGlow] = useState(DEFAULT_GLOW);
  const [isMobileViewport, setIsMobileViewport] = useState(
    isMobileCoverflowViewport,
  );
  const [debug, setDebug] = useState<HeroDebugState>(() =>
    loadHeroDebug(isMobileCoverflowViewport()),
  );
  const [debugOpen, setDebugOpen] = useState(HERO_DEBUG_ENABLED);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [addedToPocket, setAddedToPocket] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(COVERFLOW_MOBILE_QUERY);
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!HERO_DEBUG_ENABLED || typeof window === "undefined") return;
    window.localStorage.setItem(HERO_DEBUG_STORAGE_KEY, JSON.stringify(debug));
  }, [debug]);

  useEffect(() => {
    let cancelled = false;
    void loadModels()
      .then((models) => {
        if (cancelled) return;
        const fromModels = iterationsFromModels(models);
        setCatalog(
          fromModels.items.length
            ? fromModels
            : iterationsFromFeatured(featured),
        );
      })
      .catch(() => {
        if (!cancelled) setCatalog(iterationsFromFeatured(featured));
      });
    return () => {
      cancelled = true;
    };
  }, [featured]);

  const items = catalog?.items ?? [];
  const focusedItem = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const sync = () => {
      if (!focusedItem) {
        setAddedToPocket(false);
        return;
      }
      const target = catalog?.playById.get(focusedItem.id);
      setAddedToPocket(isPackInCart(focusedItem.id, target?.foilId, target?.id));
    };
    sync();
    return subscribeCart(sync);
  }, [catalog, focusedItem]);

  useEffect(() => {
    if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
      setGlow(items[0].backgroundColor || DEFAULT_GLOW);
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (!catalog) return;
    const first = catalog.items[0];
    if (!first?.videoUrl) {
      onReadyRef.current?.();
      return;
    }
    const input = {
      videoUrl: first.videoUrl,
      fitMode: first.fitMode || PACK_VIDEO_FIT_MODE,
      textureTransform: first.textureTransform || DEFAULT_VIDEO_TEXTURE_TRANSFORM,
      flipY: true,
      textureSize: PACK_TEXTURE_SIZE,
    };
    const release = preloadVideoTexture(input);
    const unsubscribe = subscribeVideoTextureReady(
      makeVideoTextureCacheKey(input),
      () => onReadyRef.current?.(),
      () => onReadyRef.current?.(),
    );
    return () => {
      unsubscribe();
      release();
    };
  }, [catalog]);

  const cameraSettings = useMemo<CoverFlowCameraSettings>(() => {
    const base = isMobileViewport
      ? MOBILE_COVERFLOW_CAMERA
      : HOME_COVERFLOW_CAMERA;
    return {
      ...base,
      packsX: debug.packsX,
      packsY: debug.packsY,
      modelY: debug.modelY,
      cameraX: debug.cameraX,
      cameraY: debug.cameraY,
      cameraZ: debug.cameraZ,
      lookAtY: debug.lookAtY,
      fov: debug.fov,
    };
  }, [debug, isMobileViewport]);

  function updateDebug<K extends keyof HeroDebugState>(
    key: K,
    value: HeroDebugState[K],
  ) {
    setDebug((current) => ({ ...current, [key]: value }));
  }

  async function copyDebug() {
    const snippet = [
      `heading: x ${formatDebugNumber(debug.headingX)}px, y ${formatDebugNumber(debug.headingY)}rem`,
      `packsX: ${debug.packsX},`,
      `packsY: ${debug.packsY},`,
      `modelY: ${debug.modelY},`,
      `cameraX: ${debug.cameraX},`,
      `cameraY: ${debug.cameraY},`,
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

  if (!catalog) {
    return (
      <div
        className="home-featured-coverflow is-loading"
        aria-hidden="true"
      />
    );
  }

  if (!items.length) return null;

  return (
    <div
      className="home-featured-coverflow"
      style={{
        ["--overlay-gradient-color-end" as string]: glow,
      }}
    >
      <div className="stage-packs">
        <div
          className="packs-glow-stack packs-glow-stack--base"
          aria-hidden="true"
        >
          <div className="packs-circle packs-circle--bloom" />
          <div className="packs-circle packs-circle--core" />
        </div>
        <CoverFlowCarousel
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDeselect={() => setSelectedId(null)}
          cameraSettings={cameraSettings}
          onFocusChange={(item) => {
            setGlow(item?.backgroundColor || DEFAULT_GLOW);
          }}
          formatPrice={(price) => String(price)}
          disableSwipeDownDeactivate
          disableWheelPaging
          buyLabel={addedToPocket ? "In Pocket" : "Add Pack"}
          buyLeadingIcon={
            addedToPocket ? (
              <Check aria-hidden="true" strokeWidth={2.75} />
            ) : undefined
          }
          buyDisabled={addedToPocket}
          onBuy={(item) => {
            const target = catalog.playById.get(item.id);
            if (!target || isPackInCart(item.id, target.foilId, target.id)) return;
            onPlay(target);
          }}
        />
        {HERO_DEBUG_ENABLED && debugOpen ? (
          <div className="coverflow-center-guide" aria-hidden="true">
            <span className="coverflow-center-guide__line" />
            <span className="coverflow-center-guide__label">center</span>
          </div>
        ) : null}
      </div>
      {HERO_DEBUG_ENABLED && typeof document !== "undefined"
        ? createPortal(
            <aside
              className={[
                "home-hero-debug",
                "home-hero-debug--center",
                debugOpen ? "" : "is-collapsed",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Hero placement debug"
            >
              <div className="home-hero-debug__head">
                <p className="home-hero-debug__title">Coverflow center</p>
                <div className="home-hero-debug__actions">
                  <button
                    type="button"
                    className="home-hero-debug__btn"
                    onClick={() => setDebug(defaultHeroDebug(isMobileViewport))}
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
                    onClick={() => setDebugOpen((open) => !open)}
                  >
                    {debugOpen ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="home-hero-debug__body">
                <div className="home-hero-debug__section">
                  <p className="home-hero-debug__section-title">
                    Horizontal center
                  </p>
                  <p className="home-hero-debug__hint">
                    Green line = viewport center. Nudge Camera X / Packs X until
                    the active pack sits on it.
                  </p>
                  <HeroDebugField
                    label="Camera X"
                    value={debug.cameraX}
                    min={-2}
                    max={2}
                    step={0.005}
                    onChange={(value) => updateDebug("cameraX", value)}
                  />
                  <HeroDebugField
                    label="Packs X"
                    value={debug.packsX}
                    min={-2}
                    max={2}
                    step={0.005}
                    onChange={(value) => updateDebug("packsX", value)}
                  />
                </div>
                <div className="home-hero-debug__section">
                  <p className="home-hero-debug__section-title">
                    Collect Reveal text
                  </p>
                  <HeroDebugField
                    label="Heading X"
                    value={debug.headingX}
                    min={-240}
                    max={240}
                    step={1}
                    onChange={(value) => updateDebug("headingX", value)}
                  />
                  <HeroDebugField
                    label="Heading Y"
                    value={debug.headingY}
                    min={-2}
                    max={16}
                    step={0.05}
                    onChange={(value) => updateDebug("headingY", value)}
                  />
                </div>
                <div className="home-hero-debug__section">
                  <p className="home-hero-debug__section-title">Cards</p>
                  <HeroDebugField
                    label="Packs Y"
                    value={debug.packsY}
                    min={-3}
                    max={1.5}
                    step={0.01}
                    onChange={(value) => updateDebug("packsY", value)}
                  />
                  <HeroDebugField
                    label="Model Y"
                    value={debug.modelY}
                    min={-2}
                    max={1.5}
                    step={0.01}
                    onChange={(value) => updateDebug("modelY", value)}
                  />
                  <HeroDebugField
                    label="Camera Y"
                    value={debug.cameraY}
                    min={-1.5}
                    max={2}
                    step={0.01}
                    onChange={(value) => updateDebug("cameraY", value)}
                  />
                  <HeroDebugField
                    label="Look at Y"
                    value={debug.lookAtY}
                    min={-1.5}
                    max={1.5}
                    step={0.01}
                    onChange={(value) => updateDebug("lookAtY", value)}
                  />
                  <HeroDebugField
                    label="Camera Z"
                    value={debug.cameraZ}
                    min={3}
                    max={10}
                    step={0.05}
                    onChange={(value) => updateDebug("cameraZ", value)}
                  />
                  <HeroDebugField
                    label="FOV"
                    value={debug.fov}
                    min={18}
                    max={55}
                    step={0.5}
                    onChange={(value) => updateDebug("fov", value)}
                  />
                </div>
              </div>
            </aside>,
            document.body,
          )
        : null}
    </div>
  );
}
