import { useAuth } from "@/contexts/AuthContext";
import { HomeFeedScreen } from "@/components/home/HomeFeedScreen";

export function HomeFeedPage() {
  const {
    resumeLikeId,
    consumeResumeLike,
    openPurchase,
    requireAuth,
    openCreator,
    authed,
  } = useAuth();

  return (
    <HomeFeedScreen
      active
      resumeLikeId={resumeLikeId}
      onResumeLikeConsumed={consumeResumeLike}
      onBuyPack={(pack) => openPurchase(pack, "buy-pack")}
      onLikeAttempt={(id) => {
        if (authed) return true;
        requireAuth({ type: "like", feedItemId: id });
        return false;
      }}
      onOpenCreator={openCreator}
    />
  );
}
