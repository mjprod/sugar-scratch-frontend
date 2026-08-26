import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FollowingScreen } from "@/components/profile/FollowingScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";

export function FollowingPage() {
  const navigate = useNavigate();
  const goBack = useGoBack(Paths.profile);
  const { openCreator } = useAuth();
  return (
    <FollowingScreen
      onBack={goBack}
      onOpenCreator={(id) => openCreator(id)}
      onDiscoverCreators={() => navigate(Paths.discover)}
    />
  );
}
