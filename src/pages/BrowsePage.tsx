import { useAuth } from "@/contexts/useAuth";
import { useWallet } from "@/contexts/WalletContext";
import { GuestHomeLanding } from "@/components/home/GuestHomeLanding";
import { HomeVersion2Screen } from "@/components/home/HomeVersion2Screen";

export function BrowsePage() {
  const {
    restart,
    addToCart,
    openCreator,
    requireAuth,
    authed,
  } = useAuth();
  const { addDiamonds } = useWallet();

  if (!authed) {
    return <GuestHomeLanding />;
  }

  return (
    <HomeVersion2Screen
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
    />
  );
}
