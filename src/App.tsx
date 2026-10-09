import { LazyMotion } from "framer-motion";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { MemoryTransitionProvider } from "@/components/memory/MemoryTransition";
import { SitePreloader } from "@/components/SitePreloader";
import { MotionProvider } from "@/features/collection/context/MotionContext";
import { loadMotionFeatures } from "@/lib/loadMotionFeatures";
import { AppRoutes } from "@/routes/AppRoutes";
import { PageReadyProvider } from "@/shared/ui/PageTransition";

export default function App() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <SearchProvider>
              <PageReadyProvider>
                <MemoryTransitionProvider>
                  <MotionProvider>
                    <AppRoutes />
                    <SitePreloader />
                  </MotionProvider>
                </MemoryTransitionProvider>
              </PageReadyProvider>
            </SearchProvider>
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </LazyMotion>
  );
}
