import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { StoreScreen } from "@/components/store/StoreScreen";
import { isDemoMode } from "@/lib/demo";
import {
  addUnopenedFromPurchase,
  listUnopenedInstances,
  syncMyPacks,
} from "@/services/packInventory";
import type { RedeemReward } from "@/services/redeem";

export function StorePage() {
  const {
    closeSecondary,
    openPurchase,
    bumpInventoryRevision,
    setPurchasedPacks,
  } = useAuth();
  const { addCoins, addDiamonds, refreshWallet } = useWallet();

  async function onPackReward(
    reward: Extract<RedeemReward, { type: "free_pack" }>,
  ) {
    if (isDemoMode()) {
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

    const synced = await syncMyPacks();
    if (!synced) return {};
    bumpInventoryRevision();
    setPurchasedPacks((n) => n + 1);
    const instance =
      listUnopenedInstances().find((pack) => pack.catalogPackId === reward.packId) ??
      null;
    return { instanceId: instance?.instanceId };
  }

  return (
    <StoreScreen
      onBack={() => closeSecondary("store")}
      onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
        addDiamonds(gained);
        addCoins(gainedCoins);
      }}
      onDiamondReward={(amount) => {
        if (isDemoMode()) addDiamonds(amount);
        else void refreshWallet();
      }}
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
