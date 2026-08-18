import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { HomeScreen } from "@/components/browse/BrowseScreen";

export function BrowsePage() {
  const {
    restart,
    openPurchase,
    openCreator,
    resumeLikeId,
    consumeResumeLike,
    requireAuth,
    authed,
  } = useAuth();
  const { addDiamonds } = useWallet();
  return (
    <HomeScreen
      showTutorial={false}
      onTutorialDone={() => undefined}
      onSkipTutorial={() => undefined}
      onRestart={restart}
      onStartPlaying={(pack) => openPurchase(pack, "buy-pack")}
      onOpenCreator={openCreator}
      onClaimDaily={(diamonds) => addDiamonds(diamonds)}
      resumeLikeId={resumeLikeId}
      onResumeLikeConsumed={consumeResumeLike}
      onLikeAttempt={(id) => {
        if (authed) return true;
        requireAuth({ type: "like", feedItemId: id });
        return false;
      }}
    />
  );
}
