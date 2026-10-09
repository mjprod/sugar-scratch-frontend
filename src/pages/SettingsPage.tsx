import "@/components/settings/SettingsScreen.css";
import { useAuth } from "@/contexts/useAuth";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export function SettingsPage() {
  const { closeSecondary, requestTab } = useAuth();
  return (
    <SettingsScreen
      onBack={() => closeSecondary("settings")}
      onReplayTutorials={() => requestTab("bag")}
    />
  );
}
