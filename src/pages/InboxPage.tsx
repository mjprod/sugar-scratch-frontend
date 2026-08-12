import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { InboxScreen } from "@/components/inbox/InboxScreen";
import type { InboxMessage } from "@/services/inbox";

export function InboxPage() {
  const {
    closeSecondary,
    openStore,
    openCreator,
    requestTab,
    guest,
  } = useAuth();
  const { coins, diamonds } = useWallet();

  function handleInboxAction(message: InboxMessage, source: "row" | "cta") {
    const cta = message.cta;
    if (source === "cta" && cta) {
      if (cta.action === "navigate" && cta.targetId === "store") {
        openStore();
        return;
      }
      if (cta.action === "open_pack" || cta.action === "view_pack") {
        requestTab("bag");
        return;
      }
      if (cta.action === "view_reward") {
        requestTab("hub");
        return;
      }
    }
    if (message.type === "creator_drop" && message.creatorId) {
      openCreator(message.creatorId);
      return;
    }
    if (message.type === "payment_failure") {
      openStore();
      return;
    }
    if (message.type === "limited_expiring") {
      requestTab("feed");
    }
  }

  return (
    <InboxScreen
      onBack={() => closeSecondary("inbox")}
      onMessageAction={handleInboxAction}
      coins={guest ? null : coins}
      diamonds={guest ? null : diamonds}
    />
  );
}
