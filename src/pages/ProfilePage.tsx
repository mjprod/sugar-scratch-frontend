import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { UserDashboardScreen } from "@/components/profile/ProfileScreen";
import { Paths } from "@/routes/Paths";

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, logout, openInbox, openStore, inboxUnread } = useAuth();
  const { coins, diamonds } = useWallet();
  return (
    <UserDashboardScreen
      name={profile.displayName || profile.username}
      username={profile.username}
      avatar={profile.avatar}
      coins={coins}
      diamonds={diamonds}
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
