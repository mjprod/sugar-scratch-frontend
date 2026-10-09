import "@/components/rewards/RewardsScreen.css";
import { useAuth } from "@/contexts/useAuth";
import { HubScreen } from "@/components/rewards/RewardsScreen";

export function RewardsPage() {
  const { openStore } = useAuth();
  return <HubScreen onOpenStore={openStore} />;
}
