import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import { CreatorScreen } from "@/components/creator/CreatorScreen";

export function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openPurchase } = useAuth();
  if (!id) return null;
  return (
    <CreatorScreen
      creatorId={id}
      onBack={() => navigate(Paths.home)}
      onBuyPack={(pack) => openPurchase(pack, "buy-pack")}
    />
  );
}
