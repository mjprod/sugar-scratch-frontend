import "@/components/settings/ChangePasswordScreen.css";
import { useAuth } from "@/contexts/useAuth";
import { ChangePasswordScreen } from "@/components/settings/ChangePasswordScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { getAuthProvider } from "@/services/auth";
import { Paths } from "@/routes/Paths";

export function ChangePasswordPage() {
  const goBack = useGoBack(Paths.profile);
  const { openPasswordReset } = useAuth();

  return (
    <ChangePasswordScreen
      onBack={goBack}
      onForgotPassword={openPasswordReset}
      authProvider={getAuthProvider()}
    />
  );
}
