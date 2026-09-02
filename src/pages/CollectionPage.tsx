import { CollectionPage as CollectionView } from "@/components/collection/CollectionPage";
import type { ScratchReadyGroup } from "@/services/collection";
import type { PurchaseFlowPack } from "@/services/purchase";
import { trackScratchEvent } from "@/services/readyToScratch";
import { useAuth } from "@/contexts/AuthContext";

function CollectionScreen({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
  onScratchGroup,
  inventoryRevision,
}: {
  onOpenCreator: (creatorId: string, themeId?: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
  onScratchGroup: (group: ScratchReadyGroup) => void;
  inventoryRevision: number;
}) {
  return (
    <CollectionView
      onOpenCreator={onOpenCreator}
      onOpenPack={onOpenPack}
      onExplorePacks={onExplorePacks}
      onScratchGroup={onScratchGroup}
      inventoryRevision={inventoryRevision}
    />
  );
}

export function CollectionPage() {
  const {
    openCreator,
    openPurchase,
    requestTab,
    inventoryRevision,
    requireAuth,
  } = useAuth();

  return (
    <CollectionScreen
      onOpenCreator={openCreator}
      onOpenPack={(pack) => openPurchase(pack, "open-pack")}
      onExplorePacks={() => requestTab("feed")}
      inventoryRevision={inventoryRevision}
      onScratchGroup={(group: ScratchReadyGroup) => {
        trackScratchEvent("Ready To Scratch Opened", {
          packId: group.id,
        });
        if (group.kind === "photo") {
          const packId = group.id.startsWith("photo:")
            ? group.id.slice("photo:".length)
            : undefined;
          requireAuth({ type: "photo-scratch", packId });
          return;
        }
        requireAuth({
          type: "scratch",
          pack: {
            packId: group.id,
            packName: group.collectionName,
            price: "",
            creator: group.creatorName,
            entry: "scratch",
          },
        });
      }}
    />
  );
}
