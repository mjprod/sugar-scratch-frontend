import "@/components/creator/CreatorScreen.css";
import { useParams } from "react-router-dom";
import { CreatorThemeScreen } from "@/components/creator/CreatorThemeScreen";

export function CreatorThemePage() {
  const { id, themeId } = useParams<{ id: string; themeId: string }>();
  if (!id || !themeId) return null;
  return <CreatorThemeScreen creatorId={id} themeId={themeId} />;
}
