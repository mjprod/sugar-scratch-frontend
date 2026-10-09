import "@/components/inbox/InboxScreen.css";
import { useAuth } from "@/contexts/AuthContext";
import { InboxScreen } from "@/components/inbox/InboxScreen";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { Paths } from "@/routes/Paths";
import type { InboxMessage } from "@/services/inbox";

export function InboxPage() {
  const { closeSecondary, openStore, openCreator, requestTab } = useAuth();

  function handleInboxAction(message: InboxMessage) {
    const cta = message.cta;
    if (cta) {
      if (cta.action === "navigate" && cta.targetId === "store") {
        openStore();
        return;
      }
      if (cta.action === "open_pack" || cta.action === "view_pack") {
        memoryNavigate(Paths.collection);
        return;
      }
      if (cta.action === "view_reward") {
        openStore();
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
    />
  );
}
