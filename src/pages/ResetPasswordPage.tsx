import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { setNavNotice } = useAuth();
  return (
    <ResetPasswordScreen
      onBack={() => navigate(Paths.home)}
      onDone={() => {
        setNavNotice("Password updated successfully.");
        window.setTimeout(() => setNavNotice(""), 2000);
        navigate(Paths.home);
      }}
    />
  );
}
