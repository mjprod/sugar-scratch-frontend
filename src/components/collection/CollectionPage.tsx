import { useMemo, useState, type CSSProperties } from "react";
import {
  type CollectionLibraryFilter,
  type LibraryPreviewCard,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "@/services/collection";
import { getCollectionPageState } from "@/services/collectionState";
import type { PurchaseFlowPack } from "@/services/purchase";
import { CardLibraryPreview } from "./CardLibraryPreview";
import { CollectionEmptyState } from "./CollectionEmptyState";
import { CollectionPlaceholder } from "./CollectionPlaceholder";
import { CollectionSnapshot } from "./CollectionSnapshot";
import { ContinueCollectingSection } from "./ContinueCollectingSection";
import { ReadyToReveal } from "./ReadyToReveal";

type HubOverlay =
  | { kind: "library"; filter: CollectionLibraryFilter }
  | { kind: "creators" }
  | { kind: "card"; card: LibraryPreviewCard }
  | { kind: "scratch"; group: ScratchReadyGroup }
  | null;

/**
 * Collection hub — modules appear only when inventory makes them relevant.
 */
export function CollectionPage({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
  onScratchGroup,
  inventoryRevision = 0,
}: {
  onOpenCreator: (creatorId: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
  onScratchGroup?: (group: ScratchReadyGroup) => void;
  inventoryRevision?: number;
}) {
  const [overlay, setOverlay] = useState<HubOverlay>(null);
  const state = useMemo(
    () => getCollectionPageState(),
    [inventoryRevision],
  );

  const continueCreators = useMemo(
    () => state.continueCreators.filter((creator) => creator.collected > 0),
    [state.continueCreators],
  );

  function openPack(pack: UnopenedPack) {
    onOpenPack({
      packId: pack.id,
      packName: pack.name,
      price: "Free",
      creator: pack.creator,
      entry: "open",
      unopenedPacks: pack.count,
    });
  }

  function openScratch(group: ScratchReadyGroup) {
    if (onScratchGroup) {
      onScratchGroup(group);
      return;
    }
    setOverlay({ kind: "scratch", group });
  }

  return (
    <section
      data-page-scroll
      className="collection-page flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={
        {
          "--bg-primary": "oklch(0.13 0.005 285.67)",
          "--accent-pink": "oklch(0.711 0.203 357.66)",
        } as CSSProperties
      }
    >
      <div className="collection-page-content page-container">
        {state.isTrueEmpty ? (
          <CollectionEmptyState onExplorePacks={onExplorePacks} />
        ) : (
          <>
            <header className="collection-page-intro">
              <h1 className="collection-page-title">Your Collection</h1>
            </header>

            <CollectionSnapshot
              summary={state.summary}
              onOpenLibrary={(filter) =>
                setOverlay({ kind: "library", filter })
              }
              onOpenCreators={() => setOverlay({ kind: "creators" })}
            />

            {state.hasPendingReveal ? (
              <ReadyToReveal
                onOpenPack={openPack}
                onScratch={openScratch}
                onExplorePacks={onExplorePacks}
                inventoryRevision={inventoryRevision}
              />
            ) : null}

            {state.hasStartedCollection && continueCreators.length > 0 ? (
              <ContinueCollectingSection
                creators={continueCreators}
                onOpenCreator={onOpenCreator}
                onViewAll={() => setOverlay({ kind: "creators" })}
              />
            ) : null}

            {state.hasCollectedCards ? (
              <CardLibraryPreview
                onViewAll={() => setOverlay({ kind: "library", filter: "all" })}
                onOpenCard={(card) => setOverlay({ kind: "card", card })}
              />
            ) : null}
          </>
        )}
      </div>

      {overlay ? (
        <CollectionPlaceholder
          title={overlayTitle(overlay)}
          detail={overlayDetail(overlay)}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </section>
  );
}

function overlayTitle(overlay: Exclude<HubOverlay, null>): string {
  switch (overlay.kind) {
    case "library":
      return "Card Library";
    case "creators":
      return "Creators";
    case "card":
      return overlay.card.name;
    case "scratch":
      return "Scratch";
  }
}

function overlayDetail(overlay: Exclude<HubOverlay, null>): string {
  switch (overlay.kind) {
    case "library":
      return `Filter: ${overlay.filter}`;
    case "creators":
      return "Browse creators you’ve started collecting.";
    case "card":
      return overlay.card.rarity;
    case "scratch":
      return `${overlay.group.creatorName} · ${overlay.group.collectionName}`;
  }
}
