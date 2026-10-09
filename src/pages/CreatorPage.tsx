import "@/components/creator/CreatorScreen.css";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { navigateBackOr } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import { CreatorScreen } from "@/components/creator/CreatorScreen";

export function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useAuth();
  const goToCollection = useCallback(() => {
    navigateBackOr(navigate, Paths.collection);
  }, [navigate]);
  if (!id) return null;
  return (
    <CreatorScreen
      creatorId={id}
      onBack={goToCollection}
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
