import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SearchScreen } from "@/components/search/SearchScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import {
  searchPackToPurchase,
  type SearchPack,
} from "@/services/search";

export function SearchPage() {
  const location = useLocation();
  const fallback =
    (location.state as { from?: string } | null)?.from ?? Paths.home;
  const goBack = useGoBack(fallback);
  const { openCreator, openPurchase } = useAuth();

  function handleOpenPack(pack: SearchPack) {
    openPurchase(searchPackToPurchase(pack), "buy-pack");
  }

  return (
    <SearchScreen
      onCancel={goBack}
      onOpenCreator={(id) => openCreator(id)}
      onOpenPack={handleOpenPack}
    />
  );
}
