import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  resolveCollectionThemeLabel,
  type ScratchReadyGroup,
  type UnopenedPack,
} from "@/services/collection";
import { getCollectionPageState } from "@/services/collectionState";
import type { PurchaseFlowPack } from "@/services/purchase";
import { Paths } from "@/routes/Paths";
import { resolveUnopenedOpenTarget } from "@/services/scratchResume";
import { CollectionEmptyState } from "./CollectionEmptyState";
import { CollectionSnapshot } from "./CollectionSnapshot";
import { MyCollectionSection } from "./MyCollectionSection";
import { ReadyToReveal } from "./ReadyToReveal";

/**
 * Collection hub — Summary → Ready to Reveal → My Collection.
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
  const navigate = useNavigate();
  const state = useMemo(
    () => getCollectionPageState(),
    [inventoryRevision],
  );

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
        {state.isTrueEmpty ? (
          <CollectionEmptyState onExplorePacks={onExplorePacks} />
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
              onClaimReward={() => navigate(Paths.rewards)}
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
