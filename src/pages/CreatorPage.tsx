import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import { CreatorScreen } from "@/components/creator/CreatorScreen";

export function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack(Paths.home);
  const { addToCart } = useAuth();
  if (!id) return null;
  return (
    <CreatorScreen
      creatorId={id}
      onBack={goBack}
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
