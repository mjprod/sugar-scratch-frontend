import "@/components/creator/CreatorScreen.css";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Paths } from "@/routes/Paths";
import { CreatorScreen } from "@/components/creator/CreatorScreen";

export function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goToCollection = useCallback(() => {
    navigate(Paths.collection);
  }, [navigate]);
  if (!id) return null;
  return <CreatorScreen creatorId={id} onBack={goToCollection} />;
}
