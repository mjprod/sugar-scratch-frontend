import "@/components/recommend/PersonalizationSwipeScreen.css";
import { markRecommendationExplicitCompleted, saveSwipePreferences } from "@/services/recommendation";
import { useAuth } from "@/contexts/useAuth";
import { PersonalizationSwipeScreen } from "@/components/recommend/PersonalizationSwipeScreen";

export function RecSwipePage() {
  const { finishRecommendationAndResume, setPendingAfterRecFromSwipe } = useAuth();
  return (
    <PersonalizationSwipeScreen
      onContinue={(result) => {
        saveSwipePreferences(result);
        setPendingAfterRecFromSwipe(result.liked, result.passed);
        markRecommendationExplicitCompleted();
        finishRecommendationAndResume();
      }}
    />
  );
}
