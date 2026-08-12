import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { ChangePasswordScreen } from "@/components/settings/ChangePasswordScreen";
import { countUnread, INBOX_FIXTURES } from "@/services/inbox";
import { getAuthProvider } from "@/services/auth";
import { Paths } from "@/routes/Paths";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { openInbox, openPasswordReset, guest } = useAuth();
  const { diamonds } = useWallet();

  return (
    <ChangePasswordScreen
      onBack={() => navigate(Paths.settings)}
      onForgotPassword={openPasswordReset}
      diamonds={guest ? null : diamonds}
      onOpenInbox={openInbox}
      inboxUnreadCount={guest ? 0 : countUnread(INBOX_FIXTURES)}
      authProvider={getAuthProvider()}
    />
  );
}
