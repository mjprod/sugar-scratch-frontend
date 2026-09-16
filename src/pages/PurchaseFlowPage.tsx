import { Navigate, useLocation, useParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { Paths } from "@/routes/Paths";
import { isRecommendationInitialized } from "@/services/recommendation";
import { PurchaseFlow } from "@/components/purchase/PurchaseFlow";
import type { PurchaseFlowPack } from "@/services/purchase";

export function PurchaseFlowPage() {
  const location = useLocation();
  const { packId } = useParams<{ packId: string }>();
  const {
    openStore,
    requireAuth,
    guest,
    notePackPurchaseSeed,
    applyRecommendationDecision,
    setPurchasedPacks,
    requestTab,
    bumpInventoryRevision,
  } = useAuth();
  const { coins, diamonds, setDiamonds, setCoins, addCoins } = useWallet();
  const pack = (location.state as { pack?: PurchaseFlowPack } | null)?.pack;
  const isTearOpenRoute =
    location.pathname === Paths.purchaseTearOpen ||
    packId === Paths.purchaseTearOpenSlug;

  if (
    !pack ||
    (isTearOpenRoute
      ? pack.entry !== "cart-tear"
      : packId
        ? pack.packId !== packId
        : false)
  ) {
    return <Navigate to={Paths.home} replace />;
  }

  return (
    <PurchaseFlow
      pack={pack}
      diamonds={diamonds}
      coins={coins}
      onClose={() => {
        memoryNavigate(Paths.home);
        if (!isRecommendationInitialized()) {
          applyRecommendationDecision(null);
        }
      }}
      onWalletUpdate={(wallet) => {
        setDiamonds(wallet.diamonds);
        setCoins(wallet.coins);
      }}
      onComplete={({ cards, coins: rewardCoins }) => {
        if (rewardCoins > 0) addCoins(rewardCoins);
        setPurchasedPacks((count) => count + cards);
        notePackPurchaseSeed(pack.creator);
        bumpInventoryRevision();
      }}
      onGetDiamonds={() => {
        if (!guest) openStore();
        else requireAuth({ type: "store" });
      }}
      onGoHome={() => memoryNavigate(Paths.home)}
      onViewCollection={() => requestTab("bag")}
      onGoMyBag={() => requestTab("bag")}
      onReturnContext={() => requestTab("bag")}
      onInventoryChange={bumpInventoryRevision}
    />
  );
}
