import { lazy, Suspense } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { Paths } from "@/routes/Paths";
import { RouteChunkFallback } from "@/routes/RouteChunkFallback";
import { isRecommendationInitialized } from "@/services/recommendation";
import type { PurchaseFlowPack } from "@/services/purchase";

// Lazy so a deep link without pack state redirects before three.js and the
// carousels download.
const PurchaseFlow = lazy(() =>
  import("@/components/purchase/PurchaseFlow").then((m) => ({
    default: m.PurchaseFlow,
  })),
);

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
    <Suspense fallback={<RouteChunkFallback />}>
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
        onGoHome={() => memoryNavigate(Paths.discover)}
        onViewCollection={() => memoryNavigate(Paths.collection)}
        onGoMyBag={() => memoryNavigate(Paths.collection)}
        onReturnContext={() => memoryNavigate(Paths.collection)}
        onInventoryChange={bumpInventoryRevision}
      />
    </Suspense>
  );
}
