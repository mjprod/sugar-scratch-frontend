import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { StoreScreen } from "@/components/store/StoreScreen";

export function StorePage() {
  const { closeSecondary } = useAuth();
  const { addCoins, addDiamonds } = useWallet();
  return (
    <StoreScreen
      onBack={() => closeSecondary("store")}
      onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
        addDiamonds(gained);
        addCoins(gainedCoins);
      }}
    />
  );
}
