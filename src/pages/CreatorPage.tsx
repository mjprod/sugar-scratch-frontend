import { useNavigate, useParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import { CreatorScreen } from "@/components/creator/CreatorScreen";

export function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openPurchase } = useAuth();
  const { diamonds } = useWallet();
  if (!id) return null;
  return (
    <CreatorScreen
      creatorId={id}
      diamonds={diamonds}
      onBack={() => navigate(Paths.home)}
      onOpenPack={(pack) => openPurchase(pack, "open-pack")}
      onBuyPack={(pack) => openPurchase(pack, "buy-pack")}
    />
  );
}
