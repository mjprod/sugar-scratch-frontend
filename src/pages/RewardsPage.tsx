import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { HubScreen } from "@/components/rewards/RewardsScreen";
import { addUnopenedFromPurchase } from "@/services/packInventory";
import type { RedeemReward } from "@/services/redeem";

export function RewardsPage() {
  const {
    openStore,
    openPurchase,
    bumpInventoryRevision,
    setPurchasedPacks,
  } = useAuth();
  const { addDiamonds } = useWallet();

  function onPackReward(reward: Extract<RedeemReward, { type: "free_pack" }>) {
    const purchaseId = `redeem-${reward.packId}-${Date.now().toString(36)}`;
    const created = addUnopenedFromPurchase({
      purchaseId,
      catalogPackId: reward.packId,
      packName: reward.sceneName,
      creator: reward.creatorHandle,
      count: 1,
      themeName: reward.sceneName,
    });
    bumpInventoryRevision();
    setPurchasedPacks((n) => n + 1);
    return { instanceId: created[0]?.instanceId };
  }

  return (
    <HubScreen
      onClaimDaily={(diamonds) => addDiamonds(diamonds)}
      onOpenStore={openStore}
      onDiamondReward={(amount) => addDiamonds(amount)}
      onPackReward={onPackReward}
      onOpenPack={({ packId, packName, creator, instanceId }) => {
        openPurchase(
          {
            packId,
            packName,
            price: "Free",
            creator,
            entry: "open",
            unopenedPacks: 1,
            instanceId,
          },
          "open-pack",
        );
      }}
    />
  );
}
