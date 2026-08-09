import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { StoreScreen } from "@/components/store/StoreScreen";

export function StorePage() {
  const navigate = useNavigate();
  const { profile, requestTab } = useAuth();
  const { coins, diamonds, addCoins, addDiamonds } = useWallet();
  return (
    <StoreScreen
      coins={coins}
      diamonds={diamonds}
      avatar={profile.avatar}
      onBack={() => navigate(-1)}
      onProfile={() => requestTab("profile")}
      onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
        addDiamonds(gained);
        addCoins(gainedCoins);
      }}
    />
  );
}
