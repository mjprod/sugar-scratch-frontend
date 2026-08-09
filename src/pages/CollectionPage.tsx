import { CollectionPage as CollectionView } from "@/components/collection/CollectionPage";
import type { PurchaseFlowPack } from "@/services/purchase";
import { useAuth } from "@/contexts/AuthContext";

function CollectionScreen({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
}: {
  onOpenCreator: (creatorId: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
}) {
  return (
    <CollectionView
      onOpenCreator={onOpenCreator}
      onOpenPack={onOpenPack}
      onExplorePacks={onExplorePacks}
    />
  );
}

export function CollectionPage() {
  const { openCreator, openPurchase, requestTab } = useAuth();
  return (
    <CollectionScreen
      onOpenCreator={openCreator}
      onOpenPack={(pack) => openPurchase(pack, "open-pack")}
      onExplorePacks={() => requestTab("home")}
    />
  );
}
