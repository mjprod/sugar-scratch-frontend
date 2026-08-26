import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserDashboardScreen } from "@/components/profile/ProfileScreen";
import { Paths } from "@/routes/Paths";

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, logout, openInbox } = useAuth();
  return (
    <UserDashboardScreen
      name={profile.displayName || profile.username}
      username={profile.username}
      avatar={profile.avatar}
      onLogout={logout}
      onOpenEditProfile={() => navigate(Paths.editProfile)}
      onOpenChangePassword={() => navigate(Paths.changePassword)}
      onOpenFollowing={() => navigate(Paths.following)}
      onOpenGameSettings={() => navigate(Paths.gameSettings)}
      onOpenInbox={openInbox}
    />
  );
}
