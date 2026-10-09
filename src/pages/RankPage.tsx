import "@/components/home/RankScreen.css";
import { useAuth } from "@/contexts/AuthContext";
import { RankScreen } from "@/components/home/RankScreen";

export function RankPage() {
  const { addToCart } = useAuth();

  return (
    <RankScreen
      onStartPlaying={(pack) =>
        addToCart({
          packId: pack.packId,
          packName: pack.packName,
          creator: pack.creator,
          characterId: pack.characterId ?? pack.packId,
          price: pack.price,
        })
      }
    />
  );
}
