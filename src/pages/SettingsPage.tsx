import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { countUnread, INBOX_FIXTURES } from "@/services/inbox";

export function SettingsPage() {
  const { closeSecondary, requestTab, openInbox, guest } = useAuth();
  const { diamonds } = useWallet();
  return (
    <SettingsScreen
      onBack={() => closeSecondary("settings")}
      onReplayTutorials={() => requestTab("home")}
      diamonds={guest ? null : diamonds}
      onOpenInbox={openInbox}
      inboxUnreadCount={guest ? 0 : countUnread(INBOX_FIXTURES)}
    />
  );
}
