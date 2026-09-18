import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { HomeVersion2Screen } from "@/components/home/HomeVersion2Screen";

/** Alternate logged-in homepage (Figma Home node 2:20) at `/home-version2`. */
export function HomeVersion2Page() {
  const {
    restart,
    addToCart,
    openCreator,
    requireAuth,
    authed,
  } = useAuth();
  const { addDiamonds } = useWallet();

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
