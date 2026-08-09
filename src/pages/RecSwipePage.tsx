import { useNavigate } from "react-router-dom";
import { markRecommendationSkipped, saveSwipePreferences } from "@/services/recommendation";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import { PersonalizationSwipeScreen } from "@/components/recommend/PersonalizationSwipeScreen";

export function RecSwipePage() {
  const navigate = useNavigate();
  const { finishRecommendationAndResume, setPendingAfterRecFromSwipe } = useAuth();
  return (
    <PersonalizationSwipeScreen
      onContinue={(result) => {
        saveSwipePreferences(result);
        setPendingAfterRecFromSwipe(result.liked, result.passed);
        navigate(Paths.recommendDone);
      }}
      onSkip={(result) => {
        if (result.liked.length || result.passed.length) {
          saveSwipePreferences(result);
        }
        markRecommendationSkipped();
        finishRecommendationAndResume();
      }}
    />
  );
}
