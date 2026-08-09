import { useAuth } from "@/contexts/AuthContext";
import { HomeScreen } from "@/components/browse/BrowseScreen";

export function BrowsePage() {
  const { restart, openPurchase, openCreator } = useAuth();
  return (
    <HomeScreen
      showTutorial={false}
      onTutorialDone={() => undefined}
      onSkipTutorial={() => undefined}
      onRestart={restart}
      onStartPlaying={(pack) => openPurchase(pack, "buy-pack")}
      onOpenCreator={openCreator}
    />
  );
}
