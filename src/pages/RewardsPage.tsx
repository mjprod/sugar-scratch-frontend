import "@/components/rewards/RewardsScreen.css";
import { useAuth } from "@/contexts/AuthContext";
import { HubScreen } from "@/components/rewards/RewardsScreen";

export function RewardsPage() {
  const { openStore } = useAuth();
  return <HubScreen onOpenStore={openStore} />;
}
