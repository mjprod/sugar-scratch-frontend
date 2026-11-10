import "@/components/creator/CreatorScreen.css";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { CreatorPacksScreen } from "@/components/creator/CreatorPacksScreen";

export function CreatorPacksPage() {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useAuth();
  if (!id) return null;
  return (
    <CreatorPacksScreen
      creatorId={id}
      onBuyPack={(pack) =>
        addToCart({
          packId: pack.packId,
          packName: pack.packName,
          creator: pack.creator,
          characterId: pack.packId,
          price: pack.price,
        })
      }
    />
  );
}
