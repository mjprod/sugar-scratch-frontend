import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { EditProfileScreen } from "@/components/profile/EditProfileScreen";
import { Paths } from "@/routes/Paths";

export function EditProfilePage() {
  const navigate = useNavigate();
  const { profile, setProfile } = useAuth();

  return (
    <EditProfileScreen
      initial={{
        displayName: profile.displayName || profile.username || "",
        username: profile.username || "",
        avatar: profile.avatar,
        email: profile.email || "",
      }}
      onBack={() => navigate(Paths.profile)}
      onSaved={(next) => {
        setProfile((prev) => ({
          ...prev,
          displayName: next.displayName,
          username: next.username,
          avatar: next.avatar,
        }));
      }}
    />
  );
}
