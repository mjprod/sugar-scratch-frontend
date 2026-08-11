import { useAuth } from "@/contexts/AuthContext";
import { HubScreen } from "@/components/rewards/RewardsScreen";

export function RewardsPage() {
  const { openStore, openInbox } = useAuth();
  return <HubScreen onOpenStore={openStore} onOpenInbox={openInbox} />;
}
