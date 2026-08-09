import { useNavigate } from "react-router-dom";
import { markRecommendationExplicitInProgress, markRecommendationSkipped } from "@/services/recommendation";
import { useAuth } from "@/contexts/AuthContext";
import { Paths } from "@/routes/Paths";
import { RecommendationIntroScreen } from "@/components/recommend/RecommendationIntroScreen";

export function RecIntroPage() {
  const navigate = useNavigate();
  const { finishRecommendationAndResume } = useAuth();
  return (
    <RecommendationIntroScreen
      onStart={() => {
        markRecommendationExplicitInProgress();
        navigate(Paths.recommendSwipe);
      }}
      onSkip={() => {
        markRecommendationSkipped();
        finishRecommendationAndResume();
      }}
    />
  );
}
