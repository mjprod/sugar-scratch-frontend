import "@/components/home/HomeFeedScreen.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { HomeFeedScreen } from "@/components/home/HomeFeedScreen";
import { WelcomeGiftOverlay } from "@/components/welcome/WelcomeGiftOverlay";
import { Paths } from "@/routes/Paths";

export function HomeFeedPage() {
  const navigate = useNavigate();
  const {
    resumeLikeId,
    consumeResumeLike,
    requireAuth,
    openCreator,
    authed,
  } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  return (
    <>
      <HomeFeedScreen
        active={!welcomeOpen}
        resumeLikeId={resumeLikeId}
        onResumeLikeConsumed={consumeResumeLike}
        onBuyPack={(pack) => {
          const creatorId = pack.creatorId.trim();
          if (!creatorId) return;
          navigate(Paths.creatorPacks(creatorId));
        }}
        onLikeAttempt={(id) => {
          if (authed) return true;
          requireAuth({ type: "like", feedItemId: id });
          return false;
        }}
        onOpenCreator={openCreator}
      />
      <WelcomeGiftOverlay onOpenChange={setWelcomeOpen} />
    </>
  );
}
