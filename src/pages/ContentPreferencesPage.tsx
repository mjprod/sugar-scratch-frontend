import { ContentPreferencesScreen } from "@/components/profile/ContentPreferencesScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { Paths } from "@/routes/Paths";

export function ContentPreferencesPage() {
  const goBack = useGoBack(Paths.profile);
  return <ContentPreferencesScreen onBack={goBack} />;
}
