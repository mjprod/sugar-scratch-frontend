import { CollectionPage } from "../components/collection/CollectionPage";
import type { PurchaseFlowPack } from "../flow/purchase";

/** @deprecated Prefer CollectionPage — kept as App tab entry. */
export function CollectionScreen({
  onOpenCreator,
  onOpenPack,
  onExplorePacks,
}: {
  onOpenCreator: (creatorId: string) => void;
  onOpenPack: (pack: PurchaseFlowPack) => void;
  onExplorePacks: () => void;
}) {
  return (
    <CollectionPage
      onOpenCreator={onOpenCreator}
      onOpenPack={onOpenPack}
      onExplorePacks={onExplorePacks}
    />
  );
}
