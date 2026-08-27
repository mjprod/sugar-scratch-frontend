import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { HomeScreen } from "@/components/browse/BrowseScreen";

export function LoggedInHomePage() {
  const {
    restart,
    addToCart,
    openCreator,
    resumeLikeId,
    consumeResumeLike,
    requireAuth,
    authed,
  } = useAuth();
  const { addDiamonds } = useWallet();
  return (
    <>
      <HomeScreen
        showTutorial={false}
        onTutorialDone={() => undefined}
        onSkipTutorial={() => undefined}
        onRestart={restart}
        onStartPlaying={(pack) =>
          addToCart({
            packId: pack.packId,
            packName: pack.packName,
            creator: pack.creator,
            characterId: pack.characterId ?? pack.packId,
            price: pack.price,
          })
        }
        onOpenCreator={openCreator}
        onClaimDaily={(diamonds) => addDiamonds(diamonds)}
        onClaimAttempt={() => {
          if (authed) return true;
          requireAuth({ type: "claim" });
          return false;
        }}
        onOpenCollection={(creatorId) => {
          if (authed) return true;
          requireAuth({ type: "collection", creatorId });
          return false;
        }}
        resumeLikeId={resumeLikeId}
        onResumeLikeConsumed={consumeResumeLike}
        onLikeAttempt={(id) => {
          if (authed) return true;
          requireAuth({ type: "like", feedItemId: id });
          return false;
        }}
      />
    </>
  );
}
