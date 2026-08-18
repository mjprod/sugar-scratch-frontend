import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { SitePreloader } from "@/components/SitePreloader";
import { AppRoutes } from "@/routes/AppRoutes";
import { PageReadyProvider } from "@/shared/ui/PageTransition";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <PageReadyProvider>
            <AppRoutes />
            <SitePreloader />
          </PageReadyProvider>
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
