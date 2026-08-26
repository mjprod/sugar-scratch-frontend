import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import { isRecommendationInitialized } from "@/services/recommendation";
import { PurchaseFlow } from "@/components/purchase/PurchaseFlow";
import type { PurchaseFlowPack } from "@/services/purchase";

export function PurchaseFlowPage() {
  const navigate = useNavigate();
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
  const { coins, diamonds, setDiamonds, addCoins } = useWallet();
  const pack = (location.state as { pack?: PurchaseFlowPack } | null)?.pack;

  if (!pack || (packId && pack.packId !== packId)) {
    return <Navigate to={Paths.home} replace />;
  }

  return (
    <PurchaseFlow
      pack={pack}
      diamonds={diamonds}
      coins={coins}
      onClose={() => {
        navigate(Paths.home);
        if (!isRecommendationInitialized()) {
          applyRecommendationDecision(null);
        }
      }}
      onWalletUpdate={(wallet) => {
        setDiamonds(wallet.diamonds);
      }}
      onComplete={({ cards, coins: rewardCoins }) => {
        addCoins(rewardCoins);
        setPurchasedPacks((count) => count + cards);
        notePackPurchaseSeed(pack.creator);
        bumpInventoryRevision();
      }}
      onGetDiamonds={() => {
        if (!guest) openStore();
        else requireAuth({ type: "store" });
      }}
      onGoHome={() => navigate(Paths.home)}
      onViewCollection={() => requestTab("bag")}
      onGoMyBag={() => requestTab("bag")}
      onReturnContext={() => requestTab("bag")}
      onInventoryChange={bumpInventoryRevision}
    />
  );
}
