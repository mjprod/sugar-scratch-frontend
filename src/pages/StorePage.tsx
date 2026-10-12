import "@/components/store/StoreScreen.css";
import { useAuth } from "@/contexts/useAuth";
import { useWallet } from "@/contexts/WalletContext";
import { StoreScreen } from "@/components/store/StoreScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { isDemoMode } from "@/lib/demo";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { Paths } from "@/routes/Paths";
import {
  clearPackPurchaseHold,
  readPackPurchaseHold,
} from "@/services/packPurchaseHold";
import {
  addUnopenedFromPurchase,
  peekNewestUnopenedInstance,
  syncMyPacks,
  upsertInstancesFromApi,
} from "@/services/packInventory";
import type { RedeemReward } from "@/services/redeem";
import { exchangeCoinsForDiamonds } from "@/services/store";

export function StorePage() {
  const purchaseHold = readPackPurchaseHold();
  const goBack = useGoBack(purchaseHold?.returnPath || Paths.profile);
  const backLabel = purchaseHold ? "Back" : "Back to profile";
  const {
    openPurchase,
    bumpInventoryRevision,
    setPurchasedPacks,
  } = useAuth();
  const { addCoins, addDiamonds, applyWallet, coins, diamonds, refreshWallet } =
    useWallet();

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

    const grantedId = reward.instanceId?.trim();
    if (grantedId) {
      upsertInstancesFromApi([
        {
          instanceId: grantedId,
          catalogPackId: reward.packId,
          packName: reward.sceneName,
          creator: reward.creatorHandle,
          themeName: reward.sceneName,
          coverUrl: "",
          status: "unopened",
          purchaseId: `redeem-${grantedId}`,
          savedAt: Date.now(),
        },
      ]);
      bumpInventoryRevision();
      setPurchasedPacks((n) => n + 1);
      void syncMyPacks();
      return { instanceId: grantedId };
    }

    const synced = await syncMyPacks();
    if (!synced) return {};
    const instance = peekNewestUnopenedInstance(reward.packId);
    if (!instance?.instanceId) return {};
    bumpInventoryRevision();
    setPurchasedPacks((n) => n + 1);
    return { instanceId: instance.instanceId };
  }

  return (
    <StoreScreen
      coinBalance={coins}
      onCoinExchange={async (diamondAmount, coinCost) => {
        const result = await exchangeCoinsForDiamonds(
          { diamonds: diamondAmount, coins: coinCost },
          { diamonds, coins },
        );
        if (result.status !== "success") return false;
        applyWallet({ diamonds: result.diamonds, coins: result.coins });
        if (result.diamonds > diamonds && readPackPurchaseHold()) {
          clearPackPurchaseHold();
          memoryNavigate(Paths.packPocket);
        }
        return true;
      }}
      onBack={goBack}
      backLabel={backLabel}
      onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
        addDiamonds(gained);
        addCoins(gainedCoins);
        if ((gained > 0 || gainedCoins > 0) && readPackPurchaseHold()) {
          clearPackPurchaseHold();
          memoryNavigate(Paths.packPocket);
        }
      }}
      onDiamondReward={(amount) => {
        if (isDemoMode()) addDiamonds(amount);
        else void refreshWallet();
        if (amount > 0 && readPackPurchaseHold()) {
          clearPackPurchaseHold();
          memoryNavigate(Paths.packPocket);
        }
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
