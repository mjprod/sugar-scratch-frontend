import "@/components/profile/ProfileScreen.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { UserDashboardScreen } from "@/components/profile/ProfileScreen";
import { Paths } from "@/routes/Paths";
import { exchangeCoinsForDiamonds } from "@/services/store";

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, logout, openInbox, openStore, inboxUnread } = useAuth();
  const { coins, diamonds, applyWallet } = useWallet();
  return (
    <UserDashboardScreen
      name={profile.displayName || profile.username}
      username={profile.username}
      avatar={profile.avatar}
      coins={coins}
      diamonds={diamonds}
      onConvertDust={async (option) => {
        const result = await exchangeCoinsForDiamonds(option, {
          diamonds,
          coins,
        });
        if (result.status !== "success") return false;
        applyWallet({ diamonds: result.diamonds, coins: result.coins });
        return true;
      }}
      onLogout={logout}
      onOpenEditProfile={() => navigate(Paths.editProfile)}
      onOpenChangePassword={() => navigate(Paths.changePassword)}
      onOpenFollowing={() => navigate(Paths.following)}
      onOpenGameSettings={() => navigate(Paths.gameSettings)}
      onOpenInbox={openInbox}
      onBuyMoreDiamonds={openStore}
      onOpenTransactionHistory={() => navigate(Paths.transactions)}
      onOpenGameHistory={() => navigate(Paths.gameHistory)}
      inboxUnreadCount={inboxUnread}
    />
  );
}
