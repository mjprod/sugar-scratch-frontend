import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DesktopCoverFlow,
  HOME_COVERFLOW_CAMERA,
} from "@/components/home/DesktopCoverFlow";
import { MobileCssCarousel } from "@/features/packs/MobileCssCarousel";
import {
  packItemToIteration,
  type Iteration,
} from "@/features/packs/types";
import { useModels } from "@/hooks/useModels";
import {
  resolveCollectionThemeLabel,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "@/services/collection";
import {
  cardPackNameFromModel,
  isVideoSrc,
  matchModel,
  modelAvatarUrl,
  modelId,
  packFacePosterFromModel,
  packFaceVideoFromModel,
} from "@/services/models";
import {
  cardActionForGroup,
  listAllReadyScratch,
  listUnopenedPackShelf,
} from "@/services/scratchResume";
import { trackScratchEvent } from "@/services/readyToScratch";

/** Display-only: real theme name, never foil placeholders like "Pack 1". */
function themeLabel(
  name: string,
  opts?: { catalogPackId?: string; creator?: string },
) {
  return (
    resolveCollectionThemeLabel({
      themeName: name,
      packName: name,
      catalogPackId: opts?.catalogPackId,
      creator: opts?.creator,
    }) || name.replace(/\s+Pack$/i, "")
  );
}

type ContinueTile = {
  id: string;
  coverUrl: string;
  posterUrl?: string;
  title: string;
  ariaLabel: string;
  onActivate: () => void;
};

/**
 * Figma MyCollection "Continue where you left off…" strip (node 123:491).
 * Unopened packs + ready scratches as compact portrait tiles with play CTA.
 */
export function ReadyToReveal({
  onOpenPack,
  onScratch,
  onExplorePacks: _onExplorePacks,
  scratchGroups,
  unopenedPacks,
  inventoryRevision = 0,
  /** Keep the continue shell + #ready-heading when reveal=packs lands empty. */
  forceEmptyReveal = false,
}: {
  onOpenPack: (pack: UnopenedPack) => void;
  onScratch: (group: ScratchReadyGroup) => void;
  /** Kept for callers; empty state no longer renders a CTA here. */
  onExplorePacks?: () => void;
  scratchGroups?: ScratchReadyGroup[];
  unopenedPacks?: UnopenedPack[];
  inventoryRevision?: number;
  forceEmptyReveal?: boolean;
}) {
  void _onExplorePacks;
  const [searchParams] = useSearchParams();
  const revealPacks =
    forceEmptyReveal || searchParams.get("reveal") === "packs";
  const models = useModels();
  const packs = useMemo(
    () => unopenedPacks ?? listUnopenedPackShelf(),
    [unopenedPacks, inventoryRevision],
  );
  const scratches = useMemo(
    () => scratchGroups ?? listAllReadyScratch(),
    [scratchGroups, inventoryRevision],
  );

  const tiles = useMemo(() => {
    const packTiles = packs.map((pack) => {
      const model = matchModel(models, {
        packId: pack.catalogPackId ?? pack.id,
        name: pack.creator,
      });
      // Retired local fixtures (ep1 / Neon Rain) are not in GET /api/models.
      if (!model) return null;
      const foilHints = {
        packId: pack.catalogPackId ?? pack.id,
        packName: pack.name,
        themeName: pack.name,
      };
      const title =
        cardPackNameFromModel(model, foilHints) ||
        themeLabel(pack.name, {
          catalogPackId: pack.catalogPackId,
          creator: pack.creator,
        });
      const modelVideo = packFaceVideoFromModel(model, foilHints) || "";
      const modelPoster = packFacePosterFromModel(model, foilHints) || "";
      const packCover = (pack.coverUrl || "").trim();
      const packCoverIsApi =
        packCover.startsWith("/models/") ||
        packCover.startsWith("/cards/") ||
        packCover.startsWith("/photo-scratch/");
      const videoUrl =
        modelVideo ||
        (isVideoSrc(packCover) && packCoverIsApi ? packCover : "");
      const posterUrl =
        modelPoster ||
        (!isVideoSrc(packCover) && packCoverIsApi ? packCover : "") ||
        undefined;
      const avatarFallback =
        modelAvatarUrl(model) ||
        (model ? `/models/${modelId(model)}/avatar.jpeg` : "");
      return {
        id: `pack:${pack.id}`,
        coverUrl: videoUrl || posterUrl || avatarFallback,
        posterUrl: posterUrl || avatarFallback || undefined,
        title,
        ariaLabel: `Open ${title}`,
        onActivate: () => onOpenPack(pack),
      };
    });

    const cardTiles = scratches.map((group) => {
      const model = matchModel(models, {
        packId: group.id.replace(/^(photo|motion):/, ""),
        name: group.creatorName,
      });
      if (!model) return null;
      const foilHints = {
        packId: group.id.replace(/^(photo|motion):/, ""),
        packName: group.collectionName,
        themeName: group.collectionName,
      };
      const title =
        cardPackNameFromModel(model, foilHints) ||
        themeLabel(group.collectionName, {
          creator: group.creatorName,
        });
      const modelVideo = packFaceVideoFromModel(model, foilHints) || "";
      const modelPoster = packFacePosterFromModel(model, foilHints) || "";
      const groupCover = (group.coverUrl || "").trim();
      const groupCoverIsApi =
        groupCover.startsWith("/models/") ||
        groupCover.startsWith("/cards/") ||
        groupCover.startsWith("/photo-scratch/");
      const videoUrl =
        modelVideo ||
        (isVideoSrc(groupCover) && groupCoverIsApi ? groupCover : "");
      const posterUrl =
        modelPoster ||
        (!isVideoSrc(groupCover) && groupCoverIsApi ? groupCover : "") ||
        undefined;
      const avatarFallback =
        modelAvatarUrl(model) ||
        (model ? `/models/${modelId(model)}/avatar.jpeg` : "");
      const action =
        cardActionForGroup(group) === "resume" ? "Resume" : "Scratch";
      return {
        id: `card:${group.id}`,
        coverUrl: videoUrl || posterUrl || avatarFallback,
        posterUrl: posterUrl || avatarFallback || undefined,
        title,
        ariaLabel: `${action} ${title}`,
        onActivate: () => onScratch(group),
      };
    });

    return [...packTiles, ...cardTiles].flatMap((tile) =>
      tile ? [tile] : [],
    );
  }, [packs, scratches, models, onOpenPack, onScratch]);

  // Hide the whole continue card when there is nothing to open or play,
  // unless auth landed on ?reveal=packs and needs the dedicated empty shell.
  if (tiles.length === 0 && !forceEmptyReveal) return null;

  return (
    <ContinueSection
      tiles={tiles}
      revealPacks={revealPacks}
      packCount={packs.length}
      scratchCount={scratches.length}
      inventoryRevision={inventoryRevision}
    />
  );
}

function tileToIteration(tile: ContinueTile): Iteration {
  const cover = (tile.coverUrl || "").trim();
  const poster = (tile.posterUrl || "").trim();
  const videoUrl = isVideoSrc(cover) ? cover : "";
  return packItemToIteration({
    id: tile.id,
    characterId: tile.id,
    name: tile.title,
    modelUrl: "",
    modelName: tile.title,
    videoUrl,
    posterUrl: poster || (!videoUrl ? cover : "") || undefined,
    price: 0,
    girlName: tile.title,
    packNumber: 1,
    packName: tile.title,
    flagEmoji: "",
    backgroundColor: "oklch(0.798 0.104 207.84)",
  });
}

const CONTINUE_DESKTOP_QUERY = "(min-width: 1024px)";

function useContinueDesktop() {
  const [desktop, setDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(CONTINUE_DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(CONTINUE_DESKTOP_QUERY);
    const apply = () => setDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return desktop;
}

function ContinueSection({
  tiles,
  revealPacks,
  packCount,
  scratchCount,
  inventoryRevision,
}: {
  tiles: ContinueTile[];
  revealPacks: boolean;
  packCount: number;
  scratchCount: number;
  inventoryRevision: number;
}) {
  const items = useMemo(() => tiles.map(tileToIteration), [tiles]);
  const desktop = useContinueDesktop();
  const activateById = useMemo(() => {
    const map = new Map(tiles.map((tile) => [tile.id, tile.onActivate]));
    return (item: Iteration) => {
      map.get(item.id)?.();
    };
  }, [tiles]);

  useEffect(() => {
    if (scratchCount > 0) {
      trackScratchEvent("Ready To Scratch Viewed", {
        count: scratchCount,
      });
    }
  }, [scratchCount, inventoryRevision]);

  useEffect(() => {
    if (!revealPacks) return;
    document.getElementById("ready-heading")?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [revealPacks, packCount]);

  return (
    <section
      className="mc-continue"
      aria-labelledby="ready-heading"
      id="ready-heading-section"
    >
      <div className="mc-continue-panel">
        <h2 id="ready-heading" className="mc-continue-title">
          Continue where you left off…
        </h2>
        {items.length > 0 ? (
          <div className="mc-continue-carousel">
            {desktop ? (
              <DesktopCoverFlow
                items={items}
                selectedId={null}
                glow="oklch(0.798 0.104 207.84)"
                playOnlyCta
                cameraSettings={{ ...HOME_COVERFLOW_CAMERA, packsY: -0.74 }}
                buying={false}
                addedToPocket={false}
                confirmBuy={false}
                onSelect={() => {}}
                onDeselect={() => {}}
                onFocusChange={() => {}}
                onBuy={activateById}
              />
            ) : (
              <MobileCssCarousel
                items={items}
                compact
                onSelect={activateById}
              />
            )}
          </div>
        ) : (
          <div className="mc-continue-row" role="list" />
        )}
      </div>
    </section>
  );
}
