import { useNavigate, useSearchParams } from "react-router-dom";
import { GameHistoryScreen } from "@/components/history/GameHistoryScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";

export function GameHistoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const purchaseFilterId = params.get("purchase");
  const goBack = useGoBack(Paths.profile);

  return (
    <GameHistoryScreen
      onBack={goBack}
      onExplorePacks={() => navigate(Paths.home)}
      purchaseFilterId={purchaseFilterId}
    />
  );
}
