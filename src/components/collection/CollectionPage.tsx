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
    setReady(false);

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
          <header className="collection-page-intro">
            <h1 className="collection-page-title">Collection</h1>
            <p className="collection-empty-copy">Loading your collection…</p>
          </header>
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
