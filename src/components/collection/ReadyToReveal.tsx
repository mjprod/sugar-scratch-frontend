import { useEffect, useMemo, useState } from "react";
import { type ScratchReadyGroup, type UnopenedPack } from "@/services/collection";
import { listUnopenedGroups } from "@/services/packInventory";
import {
  listReadyToScratch,
  trackScratchEvent,
} from "@/services/readyToScratch";
import { RevealInventoryTile } from "./RevealInventoryTile";

type ReadySegment = "packs" | "scratch";

/** Display-only: drop trailing " Pack" from theme labels. */
function themeLabel(name: string) {
  return name.replace(/\s+Pack$/i, "");
}

function defaultSegment(
  scratchCount: number,
  packCount: number,
): ReadySegment {
  if (scratchCount > 0) return "scratch";
  if (packCount > 0) return "packs";
  return "scratch";
}

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
  onExplorePacks: () => void;
  scratchGroups?: ScratchReadyGroup[];
  unopenedPacks?: UnopenedPack[];
  inventoryRevision?: number;
}) {
  const packs = useMemo(
    () => unopenedPacks ?? listUnopenedGroups(),
    [unopenedPacks, inventoryRevision],
  );
  const scratches = useMemo(
    () => scratchGroups ?? listReadyToScratch(),
    [scratchGroups, inventoryRevision],
  );
  const packCount = packs.reduce((sum, pack) => sum + pack.count, 0);
  const scratchCount = scratches.reduce((sum, group) => sum + group.count, 0);

  useEffect(() => {
    if (scratchCount > 0) {
      trackScratchEvent("Ready To Scratch Viewed", { count: scratchCount });
    }
  }, [scratchCount, inventoryRevision]);

  const [segment, setSegment] = useState<ReadySegment>(() =>
    defaultSegment(scratchCount, packCount),
  );

  useEffect(() => {
    setSegment(defaultSegment(scratchCount, packCount));
  }, [scratchCount, packCount, inventoryRevision]);

  if (packCount === 0 && scratchCount === 0) return null;

  return (
    <section className="collection-section" aria-labelledby="ready-heading">
      <h2 id="ready-heading" className="collection-section-title">
        Ready to Reveal
      </h2>

      <div className="collection-segment" role="tablist" aria-label="Pending type">
        <button
          type="button"
          role="tab"
          aria-selected={segment === "scratch"}
          className={[
            "collection-segment-btn",
            segment === "scratch" ? "is-active" : "",
          ].join(" ")}
          onClick={() => setSegment("scratch")}
        >
          Unscratched Cards
          <span className="collection-segment-count">{scratchCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={segment === "packs"}
          className={[
            "collection-segment-btn",
            segment === "packs" ? "is-active" : "",
          ].join(" ")}
          onClick={() => setSegment("packs")}
        >
          Unopened Packs
          <span className="collection-segment-count">{packCount}</span>
        </button>
      </div>

      <div className="collection-h-row" key={segment}>
        {segment === "scratch" ? (
          scratchCount > 0 ? (
            scratches.map((group) => {
              const title = themeLabel(group.collectionName);
              const qtyLabel = `${group.count} ${
                group.count === 1 ? "Card Ready" : "Cards Ready"
              }`;
              return (
                <RevealInventoryTile
                  key={group.id}
                  coverUrl={group.coverUrl}
                  title={title}
                  creator={group.creatorName}
                  quantityLabel={qtyLabel}
                  ariaLabel={`Scratch ${title}, ${qtyLabel}`}
                  onClick={() => onScratch(group)}
                />
              );
            })
          ) : (
            <article className="collection-empty-panel ready-reveal-empty">
              <h3 className="collection-empty-title">No unscratched cards</h3>
              <p className="collection-empty-copy">
                Open a pack to add cards here.
              </p>
            </article>
          )
        ) : packCount > 0 ? (
          packs.map((pack) => {
            const title = themeLabel(pack.name);
            const qtyLabel = `${pack.count} ${pack.count === 1 ? "Pack" : "Packs"}`;
            return (
              <RevealInventoryTile
                key={pack.id}
                coverUrl={pack.coverUrl}
                title={title}
                creator={pack.creator}
                quantityLabel={qtyLabel}
                ariaLabel={`Open ${title}, ${qtyLabel}`}
                onClick={() => onOpenPack(pack)}
              />
            );
          })
        ) : (
          <article className="collection-empty-panel ready-reveal-empty">
            <h3 className="collection-empty-title">No unopened packs</h3>
            <p className="collection-empty-copy">
              Purchase packs from Browse to fill this shelf.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
