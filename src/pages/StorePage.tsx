import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { StoreScreen } from "@/components/store/StoreScreen";
import { countUnread, INBOX_FIXTURES } from "@/services/inbox";

export function StorePage() {
  const { closeSecondary, openInbox, guest } = useAuth();
  const { diamonds, addCoins, addDiamonds } = useWallet();
  return (
    <StoreScreen
      diamonds={diamonds}
      onBack={() => closeSecondary("store")}
      onOpenInbox={openInbox}
      inboxUnreadCount={guest ? 0 : countUnread(INBOX_FIXTURES)}
      onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
        addDiamonds(gained);
        addCoins(gainedCoins);
      }}
    />
  );
}
