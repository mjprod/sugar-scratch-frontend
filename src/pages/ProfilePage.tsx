import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserDashboardScreen } from "@/components/profile/ProfileScreen";
import { Paths } from "@/routes/Paths";

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const { coins, diamonds } = useWallet();
  return (
    <UserDashboardScreen
      name={profile.displayName || profile.username}
      avatar={profile.avatar}
      coins={coins}
      diamonds={diamonds}
      onLogout={logout}
      onOpenChangePassword={() => navigate(Paths.changePassword)}
    />
  );
}
