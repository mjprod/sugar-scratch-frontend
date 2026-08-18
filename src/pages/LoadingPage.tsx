import { Navigate } from "react-router-dom";
import { Paths } from "@/routes/Paths";

/** Legacy boot route — the official splash is now the SitePreloader overlay. */
export function LoadingPage() {
  return <Navigate to={Paths.home} replace />;
}
