import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
}: {
  onOpenPack: (pack: UnopenedPack) => void;
  onScratch: (group: ScratchReadyGroup) => void;
  /** Kept for callers; empty state no longer renders a CTA here. */
  onExplorePacks?: () => void;
  scratchGroups?: ScratchReadyGroup[];
  unopenedPacks?: UnopenedPack[];
  inventoryRevision?: number;
}) {
  void _onExplorePacks;
  const [searchParams] = useSearchParams();
  const revealPacks = searchParams.get("reveal") === "packs";
  const models = useModels();
  const packs = useMemo(
    () => unopenedPacks ?? listUnopenedPackShelf(),
    [unopenedPacks, inventoryRevision],
  );
  const scratches = useMemo(
    () => scratchGroups ?? listAllReadyScratch(),
    [scratchGroups, inventoryRevision],
  );

  const tiles = useMemo<ContinueTile[]>(() => {
    const packTiles: ContinueTile[] = packs.map((pack) => {
      const model = matchModel(models, {
        packId: pack.catalogPackId ?? pack.id,
        name: pack.creator,
      });
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

    const cardTiles: ContinueTile[] = scratches.map((group) => {
      const model = matchModel(models, {
        packId: group.id.replace(/^(photo|motion):/, ""),
        name: group.creatorName,
      });
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

    return [...packTiles, ...cardTiles];
  }, [packs, scratches, models, onOpenPack, onScratch]);

  // Hide the whole continue card when there is nothing to open or play.
  if (tiles.length === 0) return null;

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
  const scrollerRef = useRef<HTMLDivElement>(null);

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

        <div ref={scrollerRef} className="mc-continue-row" role="list">
          {tiles.map((tile, index) => {
            const fade =
              index === 0
                ? ""
                : index === 1
                  ? "is-dim-1"
                  : index === 2
                    ? "is-dim-2"
                    : "is-dim-3";
            return (
              <ContinueCard key={tile.id} tile={tile} className={fade} />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function isApiMediaUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (
    value.startsWith("/models/") ||
    value.startsWith("/cards/") ||
    value.startsWith("/photo-scratch/") ||
    value.startsWith("/api/")
  ) {
    return true;
  }
  try {
    if (/^https?:\/\//i.test(value)) {
      const path = new URL(value).pathname;
      return (
        path.startsWith("/models/") ||
        path.startsWith("/cards/") ||
        path.startsWith("/photo-scratch/")
      );
    }
  } catch {
    /* ignore */
  }
  return false;
}

function ContinueCard({
  tile,
  className = "",
}: {
  tile: ContinueTile;
  className?: string;
}) {
  const cover = (tile.coverUrl || "").trim();
  const poster = (tile.posterUrl || "").trim();
  const coverIsVideo = cover ? isVideoSrc(cover) : false;
  const candidates = [
    poster,
    !coverIsVideo ? cover : "",
    coverIsVideo ? cover : "",
  ].filter((src) => src && isApiMediaUrl(src));
  const imageFallback = candidates[0] || "";
  const [imgSrc, setImgSrc] = useState(imageFallback);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgSrc(imageFallback);
    setFailed(false);
  }, [imageFallback]);

  if (!imageFallback || failed) {
    return (
      <div
        className={["mc-continue-card", className].filter(Boolean).join(" ")}
        role="listitem"
      >
        <button
          type="button"
          className="mc-continue-card-hit is-empty"
          aria-label={tile.ariaLabel}
          onClick={tile.onActivate}
        />
        <button
          type="button"
          className="mc-continue-play"
          aria-label={tile.ariaLabel}
          onClick={tile.onActivate}
        >
          <Play size={10} strokeWidth={2.4} fill="currentColor" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      className={["mc-continue-card", className].filter(Boolean).join(" ")}
      role="listitem"
    >
      <button
        type="button"
        className="mc-continue-card-hit"
        aria-label={tile.ariaLabel}
        onClick={tile.onActivate}
      >
        <img
          src={imgSrc}
          alt=""
          className="mc-continue-card-img"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </button>
      <button
        type="button"
        className="mc-continue-play"
        aria-label={tile.ariaLabel}
        onClick={tile.onActivate}
      >
        <Play size={10} strokeWidth={2.4} fill="currentColor" aria-hidden />
      </button>
    </div>
  );
}
