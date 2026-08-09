import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { HomeFeedScreen } from "@/components/home/HomeFeedScreen";

export function HomeFeedPage() {
  const {
    guest,
    profile,
    resumeLikeId,
    consumeResumeLike,
    openPurchase,
    requireAuth,
    requestTab,
    openStore,
    setNavNotice,
    authed,
  } = useAuth();
  const { coins, diamonds } = useWallet();

  return (
    <HomeFeedScreen
      coins={guest ? 0 : coins}
      diamonds={guest ? 0 : diamonds}
      avatar={guest ? null : profile.avatar}
      active
      guest={guest}
      resumeLikeId={resumeLikeId}
      onResumeLikeConsumed={consumeResumeLike}
      onBuyPack={(pack) => openPurchase(pack, "buy-pack")}
      onLikeAttempt={(id) => {
        if (authed) return true;
        requireAuth({ type: "like", feedItemId: id });
        return false;
      }}
      onProfile={() => requestTab("profile")}
      onOpenStore={openStore}
      onNotify={() => {
        if (guest) {
          requireAuth({ type: "tab", tab: "profile" });
          return;
        }
        setNavNotice("You're all caught up");
        window.setTimeout(() => setNavNotice(""), 1600);
      }}
    />
  );
}
