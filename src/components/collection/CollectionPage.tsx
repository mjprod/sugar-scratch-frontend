import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
import { CollectionPromoCarousel } from "./CollectionPromoCarousel";
import { CollectionSiteFooter } from "./CollectionSiteFooter";
import { MyCollectionSection } from "./MyCollectionSection";
import { ReadyToReveal } from "./ReadyToReveal";

function firstNameFromProfile(displayName: string, username: string): string {
  const raw = (displayName || username || "").trim();
  if (!raw) return "Collector";
  const token = raw.split(/\s+/)[0] || raw;
  return token.replace(/^@/, "") || "Collector";
}

/**
 * Collection hub — Figma MyCollection (node 123:469).
 * Greeting → promo → continue strip → choose a model → footer.
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
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const revealPacks = searchParams.get("reveal") === "packs";
  const [state, setState] = useState<CollectionPageState>(() =>
    emptyCollectionPageState(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isDemoMode()) {
        await syncMyPacks().catch(() => false);
      }

      const remote = isDemoMode()
        ? null
        : await fetchCollectionPageStateRemote().catch(() => null);

      if (cancelled) return;

      if (remote) {
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

  const greetingName = firstNameFromProfile(
    profile.displayName,
    profile.username,
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
      className="collection-page mc-page flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={
        {
          "--bg-primary": "oklch(0.13 0.005 285.67)",
          "--accent-pink": "oklch(0.711 0.203 357.66)",
        } as CSSProperties
      }
    >
      <div className="collection-page-content mc-page-content page-container">
        {!ready ? (
          <CollectionPageSkeleton />
        ) : state.isTrueEmpty && !revealPacks ? (
          <CollectionEmptyState onExplorePacks={onExplorePacks} />
        ) : state.isTrueEmpty && revealPacks ? (
          <>
            <header className="mc-greeting">
              <h1 className="mc-greeting-text">
                Hi, {greetingName} let&apos;s keep collecting…
              </h1>
            </header>

            <ReadyToReveal
              onOpenPack={openPack}
              onScratch={openScratch}
              onExplorePacks={onExplorePacks}
              inventoryRevision={inventoryRevision}
              forceEmptyReveal
            />
          </>
        ) : (
          <>
            <header className="mc-greeting">
              <h1 className="mc-greeting-text">
                Hi, {greetingName} let&apos;s keep collecting…
              </h1>
            </header>

            <CollectionPromoCarousel />

            <ReadyToReveal
              onOpenPack={openPack}
              onScratch={openScratch}
              onExplorePacks={onExplorePacks}
              inventoryRevision={inventoryRevision}
            />

            <MyCollectionSection
              creators={
                collectedCreators.length > 0
                  ? collectedCreators
                  : state.continueCreators
              }
              hasPendingReveal={state.hasPendingReveal}
              onOpenCreator={onOpenCreator}
              onExplorePacks={onExplorePacks}
              onFocusReadyToReveal={() => scrollTo("ready-heading")}
            />

            <CollectionSiteFooter />
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

function CollectionPageSkeleton() {
  return (
    <div className="collection-page-skeleton mc-skeleton" aria-busy="true">
      <header className="mc-greeting">
        <SkeletonBar className="search-skeleton-title" width={240} height={19} />
      </header>
      <div className="mc-promo is-skeleton" aria-hidden="true">
        <SkeletonBar width="100%" height={100} />
      </div>
      <div className="mc-continue-panel is-skeleton" aria-hidden="true">
        <SkeletonBar width={220} height={19} />
        <div className="mc-continue-row">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBar key={i} width={70} height={127} />
          ))}
        </div>
      </div>
      <div className="mc-models is-skeleton" aria-hidden="true">
        <SkeletonBar width={160} height={24} />
        <SkeletonBar width="100%" height={163} />
        <SkeletonBar width="100%" height={103} />
        <SkeletonBar width="100%" height={103} />
      </div>
    </div>
  );
}
