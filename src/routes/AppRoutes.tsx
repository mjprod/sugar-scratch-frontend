import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppShell, OnboardShell } from "@/components/layout/Shell";
import { SoftGate } from "@/routes/SoftGate";
import { Paths } from "@/routes/Paths";
import { BrowsePage } from "@/pages/BrowsePage";
import { CollectionPage } from "@/pages/CollectionPage";
import { CreatorPage } from "@/pages/CreatorPage";
import { GamePage } from "@/pages/GamePage";
import { HomeFeedPage } from "@/pages/HomeFeedPage";
import { CoverFlowV2Page } from "@/pages/CoverFlowV2Page";
import { NavTestPage } from "@/pages/NavTestPage";
import { PreLoaderPage } from "@/pages/PreLoaderPage";
import { PhotoScratchPage } from "@/pages/PhotoScratchPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { FollowingPage } from "@/pages/FollowingPage";
import { GameSettingsPage } from "@/pages/GameSettingsPage";
import { PurchaseFlowPage } from "@/pages/PurchaseFlowPage";
import { RecCompletePage } from "@/pages/RecCompletePage";
import { WelcomePage } from "@/pages/WelcomePage";
import { RecIntroPage } from "@/pages/RecIntroPage";
import { RecSwipePage } from "@/pages/RecSwipePage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { RewardsPage } from "@/pages/RewardsPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { EditProfilePage } from "@/pages/EditProfilePage";
import { SearchPage } from "@/pages/SearchPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StorePage } from "@/pages/StorePage";
import { InboxPage } from "@/pages/InboxPage";
import { CartPage } from "@/pages/CartPage";
import { TransactionHistoryPage } from "@/pages/TransactionHistoryPage";
import { GameHistoryPage } from "@/pages/GameHistoryPage";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";

function GameCatalogRoute({ children }: { children: ReactNode }) {
  return <CatalogProvider>{children}</CatalogProvider>;
}

function ResetQueryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("reset") && location.pathname !== Paths.resetPassword) {
      navigate(
        { pathname: Paths.resetPassword, search: location.search },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}

export function AppRoutes() {
  return (
    <>
      <ResetQueryRedirect />
      <Routes>
        <Route
          path={Paths.loading}
          element={<Navigate to={Paths.home} replace />}
        />
        <Route
          path={Paths.preLoader}
          element={
            <AppShell label="Pre-loader">
              <PreLoaderPage />
            </AppShell>
          }
        />
        <Route
          path={Paths.resetPassword}
          element={
            <AuthShell mode="recover">
              <ResetPasswordPage />
            </AuthShell>
          }
        />
        <Route path={Paths.navTest} element={<NavTestPage />} />
        <Route
          path={Paths.recommend}
          element={
            <OnboardShell badge="Recommend · Intro" intro>
              <RecIntroPage />
            </OnboardShell>
          }
        />
        <Route
          path={Paths.recommendSwipe}
          element={
            <OnboardShell swipe>
              <RecSwipePage />
            </OnboardShell>
          }
        />
        <Route
          path={Paths.recommendDone}
          element={
            <OnboardShell>
              <RecCompletePage />
            </OnboardShell>
          }
        />
        <Route
          path={Paths.welcome}
          element={
            <OnboardShell>
              <WelcomePage />
            </OnboardShell>
          }
        />

        <Route
          element={
            <AppShell>
              <AppLayout />
            </AppShell>
          }
        >
          {/* Home nav → pack browse at root; Discover nav → home feed */}
          <Route index element={<BrowsePage />} />
          <Route path="discover" element={<HomeFeedPage />} />
          {/* Legacy /browse → root Home */}
          <Route path="browse" element={<Navigate to={Paths.home} replace />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="creator/:id" element={<CreatorPage />} />
          <Route
            path="collection"
            element={
              <SoftGate tab="bag">
                <CollectionPage />
              </SoftGate>
            }
          />
          <Route
            path="rewards"
            element={
              <SoftGate tab="hub">
                <RewardsPage />
              </SoftGate>
            }
          />
          <Route
            path="profile"
            element={
              <SoftGate tab="profile">
                <ProfilePage />
              </SoftGate>
            }
          />
          <Route
            path="profile/edit"
            element={
              <SoftGate tab="profile">
                <EditProfilePage />
              </SoftGate>
            }
          />
          <Route
            path="profile/following"
            element={
              <SoftGate tab="profile">
                <FollowingPage />
              </SoftGate>
            }
          />
          <Route
            path="profile/game-settings"
            element={
              <SoftGate tab="profile">
                <GameSettingsPage />
              </SoftGate>
            }
          />
          <Route
            path="profile/transactions"
            element={
              <SoftGate tab="profile">
                <TransactionHistoryPage />
              </SoftGate>
            }
          />
          <Route
            path="profile/game-history"
            element={
              <SoftGate tab="profile">
                <GameHistoryPage />
              </SoftGate>
            }
          />
          <Route path="store" element={<StorePage />} />
          <Route
            path="settings"
            element={
              <SoftGate tab="profile">
                <SettingsPage />
              </SoftGate>
            }
          />
          <Route
            path="settings/change-password"
            element={
              <SoftGate tab="profile">
                <ChangePasswordPage />
              </SoftGate>
            }
          />
          <Route
            path="inbox"
            element={
              <SoftGate tab="profile" action={{ type: "inbox" }}>
                <InboxPage />
              </SoftGate>
            }
          />
          <Route
            path="pack-pocket"
            element={
              <SoftGate tab="feed" action={{ type: "cart" }}>
                <CatalogProvider>
                  <CartPage />
                </CatalogProvider>
              </SoftGate>
            }
          />
          <Route
            path="cart"
            element={<Navigate to={Paths.packPocket} replace />}
          />
          <Route
            path="purchase/:packId"
            element={
              <CatalogProvider>
                <PurchaseFlowPage />
              </CatalogProvider>
            }
          />
          <Route
            path="coverflow-v2"
            element={
              <CatalogProvider>
                <CoverFlowV2Page />
              </CatalogProvider>
            }
          />
          <Route
            path="game"
            element={
              <GameCatalogRoute>
                <GamePage />
              </GameCatalogRoute>
            }
          />
          <Route
            path="photo-scratch"
            element={
              <GameCatalogRoute>
                <PhotoScratchPage />
              </GameCatalogRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={Paths.home} replace />} />
      </Routes>
    </>
  );
}
