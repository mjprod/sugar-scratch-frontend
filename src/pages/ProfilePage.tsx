import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserDashboardScreen } from "@/components/profile/ProfileScreen";

export function ProfilePage() {
  const { profile, openSettings, logout } = useAuth();
  const { coins, diamonds } = useWallet();
  return (
    <UserDashboardScreen
      name={profile.displayName || profile.username}
      avatar={profile.avatar}
      coins={coins}
      diamonds={diamonds}
      onSettings={openSettings}
      onLogout={logout}
    />
  );
}
