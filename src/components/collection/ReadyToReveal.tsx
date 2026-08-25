import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  resolveCollectionThemeLabel,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "@/services/collection";
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
                  const title = themeLabel(pack.name, {
                    catalogPackId: pack.catalogPackId,
                    creator: pack.creator,
                  });
                  const qtyLabel = `${pack.count} ${
                    pack.count === 1 ? "Pack" : "Packs"
                  }`;
                  return (
                    <RevealInventoryTile
                      key={pack.id}
                      coverUrl={pack.coverUrl}
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
              <h3 className="ready-reveal-group-title">
                Cards
                <span className="ready-reveal-group-count">{cardItems}</span>
              </h3>
              <div className="collection-h-row">
                {scratches.map((group) => {
                  const title = themeLabel(group.collectionName, {
                    creator: group.creatorName,
                  });
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
                      coverUrl={group.coverUrl}
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
