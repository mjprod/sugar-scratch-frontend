import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FavouritesScreen } from "@/components/profile/FavouritesScreen";
import { Paths } from "@/routes/Paths";

export function FavouritesPage() {
  const navigate = useNavigate();
  const { openCreator } = useAuth();
  return (
    <FavouritesScreen
      onBack={() => navigate(Paths.profile)}
      onOpenCreator={openCreator}
    />
  );
}
