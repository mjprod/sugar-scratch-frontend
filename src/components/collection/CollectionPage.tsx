import { useState, type CSSProperties } from "react";
import {
  type CollectionLibraryFilter,
  type LibraryPreviewCard,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "@/services/collection";
import type { PurchaseFlowPack } from "@/services/purchase";
import { CardLibraryPreview } from "./CardLibraryPreview";
import { CollectionHeader } from "./CollectionHeader";
import { CollectionPlaceholder } from "./CollectionPlaceholder";
import { CollectionSnapshot } from "./CollectionSnapshot";
import { ContinueCollectingSection } from "./ContinueCollectingSection";
import { ReadyToReveal } from "./ReadyToReveal";

type HubOverlay =
  | { kind: "search" }
  | { kind: "filter" }
  | { kind: "library"; filter: CollectionLibraryFilter }
  | { kind: "creators" }
  | { kind: "card"; card: LibraryPreviewCard }
  | { kind: "scratch"; group: ScratchReadyGroup }
  | null;

/**
 * Collection hub — achievement → ready-to-reveal → creator progress → library.
 */
export function CollectionPage({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
}: {
  onOpenCreator: (creatorId: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
}) {
  const [overlay, setOverlay] = useState<HubOverlay>(null);

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

  return (
    <section
      data-page-scroll
      className="collection-page flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={
        {
          "--bg-primary": "#070709",
          "--accent-pink": "#ff5fa2",
        } as CSSProperties
      }
    >
      <div className="collection-page-content">
        <CollectionHeader
          onSearch={() => setOverlay({ kind: "search" })}
          onFilter={() => setOverlay({ kind: "filter" })}
        />

        <CollectionSnapshot
          onOpenLibrary={(filter) => setOverlay({ kind: "library", filter })}
          onOpenCreators={() => setOverlay({ kind: "creators" })}
        />

        <ReadyToReveal
          onOpenPack={openPack}
          onScratch={(group) => setOverlay({ kind: "scratch", group })}
          onExplorePacks={onExplorePacks}
        />

        <ContinueCollectingSection
          onOpenCreator={onOpenCreator}
          onViewAll={() => setOverlay({ kind: "creators" })}
        />

        <CardLibraryPreview
          onViewAll={() => setOverlay({ kind: "library", filter: "all" })}
          onOpenCard={(card) => setOverlay({ kind: "card", card })}
        />
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
    case "search":
      return "Collection Search Overlay";
    case "filter":
      return "Collection Filter Sheet";
    case "library":
      return "Full Card Library";
    case "creators":
      return "Creator Collections List";
    case "card":
      return "Card Detail Viewer";
    case "scratch":
      return "Scratch Flow";
  }
}

function overlayDetail(overlay: Exclude<HubOverlay, null>): string {
  switch (overlay.kind) {
    case "library":
      return `Filter: ${overlay.filter === "all" ? "All collected cards" : overlay.filter}`;
    case "card":
      return `${overlay.card.name} · ${overlay.card.rarity}`;
    case "scratch":
      return `${overlay.group.creatorName} · ${overlay.group.collectionName} · ${overlay.group.count} ready`;
    default:
      return "This destination is wired for the interactive prototype.";
  }
}
