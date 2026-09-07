import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import {
  resolveCollectionThemeLabel,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "@/services/collection";
import {
  emptyCollectionPageState,
  fetchCollectionPageStateRemote,
  getCollectionPageState,
  type CollectionPageState,
} from "@/services/collectionState";
import { isDemoMode } from "@/lib/demo";
import { syncMyPacks } from "@/services/packInventory";
import type { PurchaseFlowPack } from "@/services/purchase";
import { resolveUnopenedOpenTarget } from "@/services/scratchResume";
import { CollectionEmptyState } from "./CollectionEmptyState";
import { CollectionSnapshot } from "./CollectionSnapshot";
import { MyCollectionSection } from "./MyCollectionSection";
import { ReadyToReveal } from "./ReadyToReveal";

/**
 * Collection hub — Summary → Ready to Reveal → My Collection.
 * Content comes from GET /api/me/collection (+ synced pack inventory). No fixture catalog.
 */
export function CollectionPage({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
  onScratchGroup,
  inventoryRevision = 0,
}: {
  onOpenCreator: (creatorId: string, themeId?: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
  onScratchGroup?: (group: ScratchReadyGroup) => void;
  inventoryRevision?: number;
}) {
  const [searchParams] = useSearchParams();
  const revealPacks = searchParams.get("reveal") === "packs";
  const [state, setState] = useState<CollectionPageState>(() =>
    emptyCollectionPageState(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Do not flip ready→false on inventory refresh — collapsing the page
    // shell snaps mobile scroll back to the top.

    void (async () => {
      // Keep pack shelf in sync with the server before reading local inventory.
      if (!isDemoMode()) {
        await syncMyPacks().catch(() => false);
      }

      const remote = isDemoMode()
        ? null
        : await fetchCollectionPageStateRemote().catch(() => null);

      if (cancelled) return;

      if (remote) {
        // API owns summary + My Collection creators; merge live pack/scratch counts
        // so Ready to Reveal stays consistent with local open/scratch shelves.
        const local = getCollectionPageState();
        setState({
          ...remote,
          unopenedPackCount: local.unopenedPackCount,
          unscratchedCardCount: local.unscratchedCardCount,
          hasUnopenedPacks: local.hasUnopenedPacks,
          hasUnscratchedCards: local.hasUnscratchedCards,
          hasPendingReveal: local.hasPendingReveal,
          isTrueEmpty:
            remote.isTrueEmpty &&
            !local.hasUnopenedPacks &&
            !local.hasUnscratchedCards,
          hasEverPurchasedPack:
            remote.hasEverPurchasedPack || local.hasEverPurchasedPack,
          hasStartedCollection:
            remote.hasStartedCollection || local.hasStartedCollection,
        });
      } else {
        // API unavailable — inventory shelves only (synced packs / ready scratch).
        // Do not surface fixture catalogs or stale demo creator rows.
        const local = getCollectionPageState();
        setState({
          ...emptyCollectionPageState(),
          unopenedPackCount: local.unopenedPackCount,
          unscratchedCardCount: local.unscratchedCardCount,
          hasUnopenedPacks: local.hasUnopenedPacks,
          hasUnscratchedCards: local.hasUnscratchedCards,
          hasPendingReveal: local.hasPendingReveal,
          hasEverPurchasedPack: local.hasEverPurchasedPack,
          hasStartedCollection: local.hasStartedCollection,
          totalPurchasedPacks: local.totalPurchasedPacks,
          isTrueEmpty: local.isTrueEmpty,
        });
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [inventoryRevision]);

  const collectedCreators = useMemo(
    () => state.continueCreators.filter((creator) => creator.collected > 0),
    [state.continueCreators],
  );

  function openPack(pack: UnopenedPack) {
    const target = resolveUnopenedOpenTarget(pack);
    const themeName =
      resolveCollectionThemeLabel({
        themeName: pack.name,
        packName: pack.name,
        catalogPackId: target.catalogPackId,
        creator: pack.creator,
      }) || pack.name;
    onOpenPack({
      packId: target.catalogPackId,
      packName: pack.name,
      themeName,
      price: "Free",
      creator: pack.creator,
      entry: "open",
      unopenedPacks: pack.count,
      instanceId: target.instanceId,
      purchaseId: target.purchaseId,
    });
  }

  function openScratch(group: ScratchReadyGroup) {
    onScratchGroup?.(group);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
        {!ready ? (
          <CollectionPageSkeleton />
        ) : state.isTrueEmpty && !revealPacks ? (
          <CollectionEmptyState onExplorePacks={onExplorePacks} />
        ) : state.isTrueEmpty && revealPacks ? (
          <>
            <header className="collection-page-intro">
              <h1 className="collection-page-title">Your Collection</h1>
            </header>
            <ReadyToReveal
              onOpenPack={openPack}
              onScratch={openScratch}
              onExplorePacks={onExplorePacks}
              inventoryRevision={inventoryRevision}
            />
          </>
        ) : (
          <>
            <header className="collection-page-intro">
              <h1 className="collection-page-title">Collection</h1>
            </header>

            <CollectionSnapshot
              summary={state.summary}
              hasPendingReveal={state.hasPendingReveal}
              onExplorePacks={onExplorePacks}
              onFocusReadyToReveal={() => scrollTo("ready-heading")}
              onOpenMyCollection={() => scrollTo("my-collection")}
            />

            <ReadyToReveal
              onOpenPack={openPack}
              onScratch={openScratch}
              onExplorePacks={onExplorePacks}
              inventoryRevision={inventoryRevision}
            />

            <MyCollectionSection
              creators={collectedCreators}
              hasPendingReveal={state.hasPendingReveal}
              onOpenCreator={onOpenCreator}
              onExplorePacks={onExplorePacks}
              onFocusReadyToReveal={() => scrollTo("ready-heading")}
            />
          </>
        )}
      </div>
    </section>
  );
}

function SkeletonBar({
  className,
  width,
  height,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
}) {
  return (
    <span
      className={["search-skeleton", className].filter(Boolean).join(" ")}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Fixed-height first-load shell — same pulse language as search overlay. */
function CollectionPageSkeleton() {
  return (
    <div className="collection-page-skeleton" aria-busy="true" aria-live="polite">
      <header className="collection-page-intro">
        <SkeletonBar className="search-skeleton-title" width={148} height={28} />
      </header>

      <div className="collection-snapshot is-skeleton" aria-hidden="true">
        <SkeletonBar className="search-skeleton-line" width={120} height={14} />
        <div className="collection-snapshot-metrics">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className="collection-snapshot-metric is-skeleton">
              <SkeletonBar className="search-skeleton-line" width={36} height={22} />
              <SkeletonBar className="search-skeleton-line" width={64} height={12} />
            </span>
          ))}
        </div>
      </div>

      <section className="collection-section ready-reveal is-skeleton" aria-hidden="true">
        <SkeletonBar className="search-skeleton-title" width={156} height={20} />
        <div className="collection-h-row collection-page-skeleton-row">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className="ready-reveal-tile is-skeleton">
              <SkeletonBar className="ready-reveal-tile-art-btn" />
              <span className="ready-reveal-tile-body">
                <SkeletonBar className="search-skeleton-line" width="70%" height={12} />
                <SkeletonBar className="search-skeleton-line" width="48%" height={12} />
                <SkeletonBar className="ready-reveal-tile-action is-skeleton" height={36} />
              </span>
            </span>
          ))}
        </div>
      </section>

      <section
        id="my-collection"
        className="collection-section my-collection is-skeleton"
        aria-label="My Collection loading"
      >
        <div className="my-collection-head">
          <SkeletonBar className="search-skeleton-title" width={140} height={20} />
        </div>
        <div className="my-collection-creator-row" role="presentation">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="my-collection-creator-card is-skeleton">
              <span className="my-collection-creator-art">
                <SkeletonBar className="my-collection-creator-art-fill" />
              </span>
              <span className="my-collection-creator-meta">
                <SkeletonBar className="search-skeleton-line" width="78%" height={13} />
                <SkeletonBar className="search-skeleton-line" width="52%" height={12} />
              </span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
