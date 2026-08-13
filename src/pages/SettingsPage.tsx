import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { Paths } from "@/routes/Paths";

export function SettingsPage() {
  const navigate = useNavigate();
  const { closeSecondary, requestTab } = useAuth();
  return (
    <SettingsScreen
      onBack={() => closeSecondary("settings")}
      onReplayTutorials={() => requestTab("home")}
      onOpenChangePassword={() => navigate(Paths.changePassword)}
    />
  );
}
