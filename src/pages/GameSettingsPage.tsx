import { GameSettingsScreen } from "@/components/profile/GameSettingsScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";

export function GameSettingsPage() {
  const goBack = useGoBack(Paths.profile);
  return <GameSettingsScreen onBack={goBack} />;
}
