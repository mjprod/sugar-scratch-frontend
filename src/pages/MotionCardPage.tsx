import { useParams } from "react-router-dom";
import { MotionCardScreen } from "@/components/creator/MotionCardScreen";

export function MotionCardPage() {
  const { id, cardId } = useParams<{ id: string; cardId: string }>();
  if (!id || !cardId) return null;
  return <MotionCardScreen creatorId={id} cardId={cardId} />;
}
