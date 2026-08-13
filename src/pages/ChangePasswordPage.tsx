import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ChangePasswordScreen } from "@/components/settings/ChangePasswordScreen";
import { getAuthProvider } from "@/services/auth";
import { Paths } from "@/routes/Paths";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { openPasswordReset } = useAuth();

  return (
    <ChangePasswordScreen
      onBack={() => navigate(Paths.settings)}
      onForgotPassword={openPasswordReset}
      authProvider={getAuthProvider()}
    />
  );
}
