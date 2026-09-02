import { Navigate } from "react-router-dom";
import { Paths } from "@/routes/Paths";

/** Welcome gift now lives as an overlay on Discover. */
export function WelcomePage() {
  return <Navigate to={Paths.home} replace />;
}
