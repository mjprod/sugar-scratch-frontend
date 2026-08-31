import { useAuth } from "@/contexts/AuthContext";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";
import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";

export function ResetPasswordPage() {
  const goBack = useGoBack(Paths.home);
  const { setNavNotice } = useAuth();
  return (
    <ResetPasswordScreen
      onBack={goBack}
      onDone={() => {
        setNavNotice("Password updated successfully.");
        window.setTimeout(() => setNavNotice(""), 2000);
        goBack();
      }}
    />
  );
}
