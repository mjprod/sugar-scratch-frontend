import { markRecommendationExplicitCompleted } from "@/services/recommendation";
import { useAuth } from "@/contexts/AuthContext";
import { PersonalizationCompleteScreen } from "@/components/recommend/PersonalizationCompleteScreen";

export function RecCompletePage() {
  const { finishRecommendationAndResume } = useAuth();
  return (
    <PersonalizationCompleteScreen
      onStart={() => {
        markRecommendationExplicitCompleted();
        finishRecommendationAndResume();
      }}
    />
  );
}
