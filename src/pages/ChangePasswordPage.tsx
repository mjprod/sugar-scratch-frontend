import { useAuth } from "@/contexts/AuthContext";
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
