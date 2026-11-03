import "@/components/profile/EditProfileScreen.css";
import { useAuth } from "@/contexts/useAuth";
import { EditProfileScreen } from "@/components/profile/EditProfileScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";

export function EditProfilePage() {
  const goBack = useGoBack(Paths.profile);
  const { profile, setProfile } = useAuth();

  return (
    <EditProfileScreen
      initial={{
        displayName: profile.displayName || profile.username || "",
        username: profile.username || "",
        avatar: profile.avatar,
        email: profile.email || "",
      }}
      onBack={goBack}
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
