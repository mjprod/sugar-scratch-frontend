import { useAuth } from "@/contexts/AuthContext";
import { HomeFeedScreen } from "@/components/home/HomeFeedScreen";
import { WelcomeGiftOverlay } from "@/components/welcome/WelcomeGiftOverlay";

export function HomeFeedPage() {
  const {
    resumeLikeId,
    consumeResumeLike,
    addToCart,
    requireAuth,
    openCreator,
    authed,
  } = useAuth();

  return (
    <>
      <HomeFeedScreen
        active
        resumeLikeId={resumeLikeId}
        onResumeLikeConsumed={consumeResumeLike}
        onBuyPack={(pack) =>
          addToCart({
            packId: pack.packId,
            packName: pack.packName,
            creator: pack.creator,
            characterId: pack.packId,
            price: pack.price,
          })
        }
        onLikeAttempt={(id) => {
          if (authed) return true;
          requireAuth({ type: "like", feedItemId: id });
          return false;
        }}
        onOpenCreator={openCreator}
      />
      <WelcomeGiftOverlay />
    </>
  );
}
