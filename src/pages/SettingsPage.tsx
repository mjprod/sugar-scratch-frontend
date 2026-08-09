import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export function SettingsPage() {
  const navigate = useNavigate();
  const { requestTab } = useAuth();
  return (
    <SettingsScreen
      onBack={() => navigate(-1)}
      onReplayTutorials={() => requestTab("home")}
    />
  );
}
