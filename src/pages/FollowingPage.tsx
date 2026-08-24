import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FollowingScreen } from "@/components/profile/FollowingScreen";
import { Paths } from "@/routes/Paths";

export function FollowingPage() {
  const navigate = useNavigate();
  const { openCreator } = useAuth();
  return (
    <FollowingScreen
      onBack={() => navigate(Paths.profile)}
      onOpenCreator={(id) => openCreator(id)}
      onDiscoverCreators={() => navigate(Paths.discover)}
    />
  );
}
