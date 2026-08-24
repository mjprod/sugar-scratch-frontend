import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CoverFlowCarouselV2 } from "@/features/packs/CoverFlowCarouselV2";
import {
  applyCardTopPivotPreset,
  getCardTopBounds,
  getCardTopDebug,
  matchingPivotPreset,
  resetCardTopDebug,
  setCardTopPivot,
  setCardTopRotation,
  setCardTopShowGizmo,
  subscribeCardTopBounds,
  subscribeCardTopDebug,
  type CardTopBounds,
  type CardTopDebugState,
  type CardTopPivotPreset,
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

const PIVOT_PRESETS: Array<{ id: CardTopPivotPreset; label: string }> = [
  { id: "origin", label: "Origin" },
  { id: "center", label: "Center" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
];

function CardTopDebugPanel() {
  const [debug, setDebug] = useState<CardTopDebugState>(getCardTopDebug);
  const [bounds, setBounds] = useState<CardTopBounds | null>(getCardTopBounds);
  const [open, setOpen] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const activePreset = matchingPivotPreset(debug.pivot, bounds);

  useEffect(() => subscribeCardTopDebug(setDebug), []);
  useEffect(() => subscribeCardTopBounds(setBounds), []);

  const pivotRange = bounds
    ? {
        x: { min: bounds.min.x - bounds.size.x, max: bounds.max.x + bounds.size.x },
        y: { min: bounds.min.y - bounds.size.y, max: bounds.max.y + bounds.size.y },
        z: { min: bounds.min.z - bounds.size.z, max: bounds.max.z + bounds.size.z },
      }
    : {
        x: { min: -2, max: 2 },
        y: { min: -2, max: 2 },
        z: { min: -2, max: 2 },
      };

  async function copyDebug() {
    const snippet = [
      `cardTop.rotation.x: ${debug.rotation.x},`,
      `cardTop.rotation.y: ${debug.rotation.y},`,
      `cardTop.rotation.z: ${debug.rotation.z},`,
      `cardTop.pivot.x: ${debug.pivot.x},`,
      `cardTop.pivot.y: ${debug.pivot.y},`,
      `cardTop.pivot.z: ${debug.pivot.z},`,
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
      aria-label="cardTop rotation debug"
    >
      <div className="home-hero-debug__head">
        <p className="home-hero-debug__title">cardTop</p>
        <div className="home-hero-debug__actions">
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => resetCardTopDebug()}
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
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div className="home-hero-debug__body">
        <div className="home-hero-debug__section">
          <p className="home-hero-debug__section-title">Rotate object</p>
          <CardTopDebugField
            label="Rotate X"
            value={debug.rotation.x}
            min={-180}
            max={180}
            step={1}
            suffix="°"
            onChange={(value) => setCardTopRotation({ x: value })}
          />
          <CardTopDebugField
            label="Rotate Y"
            value={debug.rotation.y}
            min={-180}
            max={180}
            step={1}
            suffix="°"
            onChange={(value) => setCardTopRotation({ y: value })}
          />
          <CardTopDebugField
            label="Rotate Z"
            value={debug.rotation.z}
            min={-180}
            max={180}
            step={1}
            suffix="°"
            onChange={(value) => setCardTopRotation({ z: value })}
          />
        </div>
        <div className="home-hero-debug__section">
          <p className="home-hero-debug__section-title">Rotation point</p>
          <div className="home-hero-debug__actions">
            {PIVOT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="home-hero-debug__btn"
                aria-pressed={activePreset === preset.id}
                onClick={() => applyCardTopPivotPreset(preset.id)}
                style={
                  activePreset === preset.id
                    ? { borderColor: "oklch(0.824 0.137 68.76)" }
                    : undefined
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <CardTopDebugField
            label="Pivot X"
            value={debug.pivot.x}
            min={pivotRange.x.min}
            max={pivotRange.x.max}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => setCardTopPivot({ x: value })}
          />
          <CardTopDebugField
            label="Pivot Y"
            value={debug.pivot.y}
            min={pivotRange.y.min}
            max={pivotRange.y.max}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => setCardTopPivot({ y: value })}
          />
          <CardTopDebugField
            label="Pivot Z"
            value={debug.pivot.z}
            min={pivotRange.z.min}
            max={pivotRange.z.max}
            step={0.01}
            suffix=""
            digits={2}
            onChange={(value) => setCardTopPivot({ z: value })}
          />
          <label className="home-hero-debug__field">
            <span>
              Show pivot
              <em>{debug.showGizmo ? "On" : "Off"}</em>
            </span>
            <input
              type="checkbox"
              checked={debug.showGizmo}
              onChange={(event) => setCardTopShowGizmo(event.target.checked)}
            />
          </label>
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
        <CardTopDebugPanel />
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
        />
      </div>
      <CardTopDebugPanel />
    </section>
  );
}
