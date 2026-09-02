import { CollectionPage } from "../components/collection/CollectionPage";
import type { ScratchReadyGroup } from "../flow/collection";
import type { PurchaseFlowPack } from "../flow/purchase";

/** @deprecated Prefer CollectionPage — kept as App tab entry. */
export function CollectionScreen({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
  onScratchGroup,
  inventoryRevision,
}: {
  onOpenCreator: (creatorId: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
  onScratchGroup?: (group: ScratchReadyGroup) => void;
  inventoryRevision?: number;
}) {
  return (
    <CollectionPage
      onOpenCreator={onOpenCreator}
      onOpenPack={onOpenPack}
      onExplorePacks={onExplorePacks}
      onScratchGroup={onScratchGroup}
      inventoryRevision={inventoryRevision}
    />
  );
}
