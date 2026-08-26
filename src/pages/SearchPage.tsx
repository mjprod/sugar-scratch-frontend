import { useAuth } from "@/contexts/AuthContext";
import { SearchScreen } from "@/components/search/SearchScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import type { SearchPack } from "@/services/search";

export function SearchPage() {
  const goBack = useGoBack(Paths.discover);
  const { openCreator, openPurchase } = useAuth();

  function handleOpenPack(pack: SearchPack) {
    openPurchase(
      {
        packId: pack.id,
        packName: pack.name,
        themeName: pack.themeName,
        price: String(pack.diamondCost),
        creator: pack.creatorName,
        entry: "purchase",
      },
      "buy-pack",
    );
  }

  return (
    <SearchScreen
      onCancel={goBack}
      onOpenCreator={(id) => openCreator(id)}
      onOpenPack={handleOpenPack}
    />
  );
}
