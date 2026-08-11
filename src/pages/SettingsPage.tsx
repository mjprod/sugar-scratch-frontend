import { useAuth } from "@/contexts/AuthContext";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export function SettingsPage() {
  const { closeSecondary, requestTab } = useAuth();
  return (
    <SettingsScreen
      onBack={() => closeSecondary("settings")}
      onReplayTutorials={() => requestTab("home")}
    />
  );
}
