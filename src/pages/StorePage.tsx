import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { StoreScreen } from "@/components/store/StoreScreen";

export function StorePage() {
  const { profile, requestTab, closeSecondary } = useAuth();
  const { coins, diamonds, addCoins, addDiamonds } = useWallet();
  return (
    <StoreScreen
      coins={coins}
      diamonds={diamonds}
      avatar={profile.avatar}
      onBack={() => closeSecondary("store")}
      onProfile={() => requestTab("profile")}
      onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
        addDiamonds(gained);
        addCoins(gainedCoins);
      }}
    />
  );
}
