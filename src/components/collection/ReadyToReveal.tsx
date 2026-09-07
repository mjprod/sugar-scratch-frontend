import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
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
  packFacePosterFromModel,
  packFaceVideoFromModel,
} from "@/services/models";
import {
  cardActionForGroup,
  listAllReadyScratch,
  listUnopenedPackShelf,
} from "@/services/scratchResume";
import { trackScratchEvent } from "@/services/readyToScratch";
import { RevealInventoryTile } from "./RevealInventoryTile";

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

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

/** Max simultaneous pack/card face decoders on mobile Ready to Reveal. */
const READY_REVEAL_LIVE_VIDEOS = 2;

type RevealMedia = {
  id: string;
  videoUrl: string;
  posterUrl?: string;
};

/**
 * Keep only the N most-visible inventory videos mounted on mobile.
 * Off-screen tiles stay on API posters.
 */
function useLiveReadyRevealVideos(
  rootRef: { current: HTMLElement | null },
  media: RevealMedia[],
  enabled: boolean,
) {
  const videoOrder = useMemo(
    () =>
      media
        .filter((item) => item.videoUrl && isVideoSrc(item.videoUrl))
        .map((item) => item.id),
    [media],
  );
  const videoOrderKey = videoOrder.join("\0");
  const [liveIds, setLiveIds] = useState<Set<string>>(
    () => new Set(videoOrder.slice(0, READY_REVEAL_LIVE_VIDEOS)),
  );

  useEffect(() => {
    const nextSeed = new Set(videoOrder.slice(0, READY_REVEAL_LIVE_VIDEOS));
    setLiveIds((prev) => {
      if (
        prev.size === nextSeed.size &&
        [...nextSeed].every((id) => prev.has(id))
      ) {
        return prev;
      }
      return nextSeed;
    });
  }, [videoOrderKey]); // eslint-disable-line react-hooks/exhaustive-deps -- key tracks order

  useEffect(() => {
    if (!enabled || videoOrder.length === 0) return;
    if (typeof IntersectionObserver === "undefined") {
      setLiveIds(new Set(videoOrder.slice(0, READY_REVEAL_LIVE_VIDEOS)));
      return;
    }

    // Collection page scrolls the viewport; section is not an overflow root.
    // Scope observations to tiles under this section host.
    const host = rootRef.current;
    const ratios = new Map<string, number>();
    let raf = 0;

    const publish = () => {
      raf = 0;
      const ranked = videoOrder
        .filter((id) => (ratios.get(id) ?? 0) > 0.08)
        .sort((a, b) => (ratios.get(b) ?? 0) - (ratios.get(a) ?? 0))
        .slice(0, READY_REVEAL_LIVE_VIDEOS);
      const next =
        ranked.length > 0
          ? ranked
          : videoOrder.slice(0, READY_REVEAL_LIVE_VIDEOS);
      setLiveIds((prev) => {
        if (
          prev.size === next.length &&
          next.every((id) => prev.has(id))
        ) {
          return prev;
        }
        return new Set(next);
      });
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(publish);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.readyRevealId;
          if (!id) continue;
          ratios.set(
            id,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }
        schedule();
      },
      {
        root: null,
        threshold: [0, 0.08, 0.25, 0.5, 0.75, 1],
        // Lead load slightly before fully on-screen (vertical page + horizontal rows).
        rootMargin: "72px 48px",
      },
    );

    const allowed = new Set(videoOrder);
    const scope: ParentNode = host ?? document;
    const nodes = scope.querySelectorAll<HTMLElement>("[data-ready-reveal-id]");
    nodes.forEach((node) => {
      const id = node.dataset.readyRevealId;
      if (!id || !allowed.has(id)) return;
      if (host && !host.contains(node)) return;
      io.observe(node);
    });

    schedule();
    return () => {
      window.cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [enabled, rootRef, videoOrder, videoOrderKey]);

  return liveIds;
}

/**
 * Ready to Reveal — unfinished owned inventory only.
 * Packs (unopened) + Cards (unscratched / resume). Rendering never settles state.
 */
export function ReadyToReveal({
  onOpenPack,
  onScratch,
  onExplorePacks,
  scratchGroups,
  unopenedPacks,
  inventoryRevision = 0,
}: {
  onOpenPack: (pack: UnopenedPack) => void;
  onScratch: (group: ScratchReadyGroup) => void;
  onExplorePacks: () => void;
  scratchGroups?: ScratchReadyGroup[];
  unopenedPacks?: UnopenedPack[];
  inventoryRevision?: number;
}) {
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

  // Header / subsection counts = actionable inventory tiles (grouped items),
  // not every card inside a grouped photo session.
  const packItems = packs.length;
  const cardItems = scratches.length;
  const cardsScroll = useHorizontalScroll(".ready-reveal-tile", cardItems);
  const sectionRef = useRef<HTMLElement | null>(null);
  const totalActions = packItems + cardItems;
  const empty = totalActions === 0;
  const showPacks = packItems > 0;
  const showCards = cardItems > 0;

  const packTiles = useMemo(() => {
    return packs.map((pack) => {
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
      const videoUrl =
        packFaceVideoFromModel(model, foilHints) ||
        (isVideoSrc(pack.coverUrl) ? pack.coverUrl : "");
      const posterUrl =
        packFacePosterFromModel(model, foilHints) ||
        (!isVideoSrc(pack.coverUrl) ? pack.coverUrl : "") ||
        undefined;
      return {
        id: `pack:${pack.id}`,
        pack,
        title,
        videoUrl: videoUrl || "",
        posterUrl,
        coverUrl: videoUrl || posterUrl || pack.coverUrl,
      };
    });
  }, [packs, models]);

  const cardTiles = useMemo(() => {
    return scratches.map((group) => {
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
      const videoUrl =
        packFaceVideoFromModel(model, foilHints) ||
        (isVideoSrc(group.coverUrl) ? group.coverUrl : "");
      const posterUrl =
        packFacePosterFromModel(model, foilHints) ||
        (!isVideoSrc(group.coverUrl) ? group.coverUrl : "") ||
        undefined;
      const isPhoto = group.kind === "photo";
      const typeLabel = isPhoto ? "Photo Card" : "Motion Card";
      const action =
        cardActionForGroup(group) === "resume" ? "Resume" : "Scratch";
      const qtyLabel =
        group.count > 1
          ? `${group.count} ${isPhoto ? "Photo Cards" : "Motion Cards"}`
          : `${group.count} ${typeLabel}`;
      return {
        id: `card:${group.id}`,
        group,
        title,
        videoUrl: videoUrl || "",
        posterUrl,
        coverUrl: videoUrl || posterUrl || group.coverUrl,
        isPhoto,
        typeLabel,
        action,
        qtyLabel,
      };
    });
  }, [scratches, models]);

  const allMedia = useMemo<RevealMedia[]>(
    () => [
      ...packTiles.map((tile) => ({
        id: tile.id,
        videoUrl: tile.videoUrl,
        posterUrl: tile.posterUrl,
      })),
      ...cardTiles.map((tile) => ({
        id: tile.id,
        videoUrl: tile.videoUrl,
        posterUrl: tile.posterUrl,
      })),
    ],
    [packTiles, cardTiles],
  );

  const [mobileLiveLimit, setMobileLiveLimit] = useState(() =>
    typeof window === "undefined" ? true : isCoarsePointer(),
  );

  useEffect(() => {
    const sync = () => setMobileLiveLimit(isCoarsePointer());
    sync();
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Mobile: only in-view tiles autoplay. Desktop keeps prior always-on budget.
  const liveEnabled = mobileLiveLimit;
  const liveIds = useLiveReadyRevealVideos(
    sectionRef,
    allMedia,
    liveEnabled,
  );

  useEffect(() => {
    if (cardItems > 0) {
      trackScratchEvent("Ready To Scratch Viewed", { count: cardItems });
    }
  }, [cardItems, inventoryRevision]);

  useEffect(() => {
    if (!revealPacks) return;
    document.getElementById("ready-heading")?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [revealPacks, packItems]);

  return (
    <section
      ref={sectionRef}
      className="collection-section ready-reveal"
      aria-labelledby="ready-heading"
    >
      <div className="ready-reveal-head">
        <div className="ready-reveal-intro">
          <h2 id="ready-heading" className="collection-section-title">
            Ready to Reveal
            {!empty ? (
              <span className="collection-section-count">{totalActions}</span>
            ) : null}
          </h2>
        </div>
      </div>

      {empty ? (
        <div className="ready-reveal-panel ready-reveal-empty">
          <h3 className="collection-empty-title">
            <span aria-hidden="true">✓ </span>
            You&apos;re all caught up
          </h3>
          <p className="collection-empty-copy">
            Everything you own has been revealed.
          </p>
          <button
            type="button"
            className="collection-snapshot-cta"
            onClick={onExplorePacks}
          >
            Explore Packs
          </button>
        </div>
      ) : (
        <div className="ready-reveal-panel">
          {showPacks ? (
            <div className="ready-reveal-group" aria-label="Packs">
              <h3 className="ready-reveal-group-title">
                Packs
                <span className="ready-reveal-group-count">{packItems}</span>
              </h3>
              <div className="collection-h-row">
                {packTiles.map((tile) => {
                  const qtyLabel = `${tile.pack.count} ${
                    tile.pack.count === 1 ? "Pack" : "Packs"
                  }`;
                  const shouldPlay = liveEnabled
                    ? liveIds.has(tile.id)
                    : Boolean(tile.videoUrl && isVideoSrc(tile.videoUrl));
                  return (
                    <RevealInventoryTile
                      key={tile.pack.id}
                      mediaId={tile.id}
                      coverUrl={tile.coverUrl}
                      posterUrl={tile.posterUrl}
                      title={tile.title}
                      creator={tile.pack.creator}
                      quantityLabel={qtyLabel}
                      actionLabel="Open Pack"
                      ariaLabel={`Open ${tile.title}, ${qtyLabel}`}
                      autoplayVideo={shouldPlay}
                      onClick={() => onOpenPack(tile.pack)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {showPacks && showCards ? (
            <div className="ready-reveal-divider" role="separator" />
          ) : null}

          {showCards ? (
            <div className="ready-reveal-group" aria-label="Cards">
              <div className="ready-reveal-group-head">
                <h3 className="ready-reveal-group-title">
                  Cards
                  <span className="ready-reveal-group-count">{cardItems}</span>
                </h3>
                <div className="ready-reveal-group-arrows">
                  <button
                    type="button"
                    className="continue-collecting-arrow is-prev"
                    aria-label="Previous cards"
                    disabled={!cardsScroll.canScrollLeft}
                    onClick={() => cardsScroll.scrollByPage(-1)}
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="continue-collecting-arrow is-next"
                    aria-label="Next cards"
                    disabled={!cardsScroll.canScrollRight}
                    onClick={() => cardsScroll.scrollByPage(1)}
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div ref={cardsScroll.scrollRef} className="collection-h-row">
                {cardTiles.map((tile) => {
                  const shouldPlay = liveEnabled
                    ? liveIds.has(tile.id)
                    : Boolean(tile.videoUrl && isVideoSrc(tile.videoUrl));
                  return (
                    <RevealInventoryTile
                      key={tile.group.id}
                      mediaId={tile.id}
                      coverUrl={tile.coverUrl}
                      posterUrl={tile.posterUrl}
                      title={tile.title}
                      creator={tile.group.creatorName}
                      quantityLabel={tile.qtyLabel}
                      typeLabel={tile.typeLabel}
                      actionLabel={tile.action}
                      ariaLabel={`${tile.action} ${tile.title}, ${tile.typeLabel}`}
                      autoplayVideo={shouldPlay}
                      onClick={() => onScratch(tile.group)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
