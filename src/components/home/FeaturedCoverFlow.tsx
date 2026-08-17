import { useEffect, useState } from "react";
import { CoverFlowCarousel } from "@/features/packs/CoverFlowCarousel";
import { packItemToIteration, type Iteration } from "@/features/packs/types";
import "@/features/packs/packs.css";
import { PACK_MODEL_URL, PACK_VIDEO_URL } from "@/lib/pack3d";
import {
  diamondCostForPackId,
  type FeaturedPack,
} from "@/services/homepage";
import {
  loadModels,
  profileFromModel,
  type BackendModel,
} from "@/services/models";

const DEFAULT_GLOW = "oklch(0.798 0.104 207.84)";
const MAX_HOME_PACKS = 10;

export type FeaturedCoverFlowPlayTarget = {
  id: string;
  name: string;
  creatorName: string;
  diamondCost: number;
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
        name: foil.label || profile.name,
        creatorName: profile.name,
        diamondCost,
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
        videoUrl: PACK_VIDEO_URL,
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

/**
 * Homepage hero — same Three.js cover-flow used on purchase choose-pack.
 */
export function FeaturedCoverFlow({
  featured,
  onPlay,
}: {
  featured: FeaturedPack[];
  onPlay: (pack: FeaturedCoverFlowPlayTarget) => void;
}) {
  const [catalog, setCatalog] = useState<CoverFlowCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glow, setGlow] = useState(DEFAULT_GLOW);

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

  useEffect(() => {
    if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
      setGlow(items[0].backgroundColor || DEFAULT_GLOW);
    }
  }, [items, selectedId]);

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
      style={{ ["--overlay-gradient-color-end" as string]: glow }}
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
          onFocusChange={(item) => {
            setGlow(item?.backgroundColor || DEFAULT_GLOW);
          }}
          formatPrice={(price) => String(price)}
          disableSwipeDownDeactivate
          onBuy={(item) => {
            const target = catalog.playById.get(item.id);
            if (target) onPlay(target);
          }}
        />
      </div>
    </div>
  );
}
