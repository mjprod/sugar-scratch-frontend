import { useEffect, useMemo } from "react";
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
  matchModel,
  packFaceVideoFromModel,
} from "@/services/models";
import {
  cardActionForGroup,
  listAllReadyScratch,
  listUnopenedPackShelf,
} from "@/services/scratchResume";
import { trackScratchEvent } from "@/services/readyToScratch";
import { RevealInventoryTile } from "./RevealInventoryTile";

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
  const totalActions = packItems + cardItems;
  const empty = totalActions === 0;
  const showPacks = packItems > 0;
  const showCards = cardItems > 0;

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
                {packs.map((pack) => {
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
                  const coverUrl =
                    packFaceVideoFromModel(model, foilHints) || pack.coverUrl;
                  const qtyLabel = `${pack.count} ${
                    pack.count === 1 ? "Pack" : "Packs"
                  }`;
                  return (
                    <RevealInventoryTile
                      key={pack.id}
                      coverUrl={coverUrl}
                      title={title}
                      creator={pack.creator}
                      quantityLabel={qtyLabel}
                      actionLabel="Open Pack"
                      ariaLabel={`Open ${title}, ${qtyLabel}`}
                      onClick={() => onOpenPack(pack)}
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
                {scratches.map((group) => {
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
                  const coverUrl =
                    packFaceVideoFromModel(model, foilHints) || group.coverUrl;
                  const isPhoto = group.kind === "photo";
                  const typeLabel = isPhoto ? "Photo Card" : "Motion Card";
                  const action =
                    cardActionForGroup(group) === "resume"
                      ? "Resume"
                      : "Scratch";
                  const qtyLabel =
                    group.count > 1
                      ? `${group.count} ${
                          isPhoto ? "Photo Cards" : "Motion Cards"
                        }`
                      : `${group.count} ${typeLabel}`;
                  return (
                    <RevealInventoryTile
                      key={group.id}
                      coverUrl={coverUrl}
                      title={title}
                      creator={group.creatorName}
                      quantityLabel={qtyLabel}
                      typeLabel={typeLabel}
                      actionLabel={action}
                      ariaLabel={`${action} ${title}, ${typeLabel}`}
                      onClick={() => onScratch(group)}
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
