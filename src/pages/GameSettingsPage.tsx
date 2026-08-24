import { useNavigate } from "react-router-dom";
import { GameSettingsScreen } from "@/components/profile/GameSettingsScreen";
import { Paths } from "@/routes/Paths";

export function GameSettingsPage() {
  const navigate = useNavigate();
  return <GameSettingsScreen onBack={() => navigate(Paths.profile)} />;
}
