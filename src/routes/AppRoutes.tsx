import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppShell, OnboardShell } from "@/components/layout/Shell";
import { SoftGate } from "@/routes/SoftGate";
import { Paths } from "@/routes/Paths";
import { RouteChunkFallback } from "@/routes/RouteChunkFallback";
import { BrowsePage } from "@/pages/BrowsePage";
import { HomeFeedPage } from "@/pages/HomeFeedPage";
import { CatalogProvider } from "@/shared/catalog/CatalogContext";

const CollectionPage = lazy(() =>
  import("@/pages/CollectionPage").then((m) => ({ default: m.CollectionPage })),
);
const CreatorPage = lazy(() =>
  import("@/pages/CreatorPage").then((m) => ({ default: m.CreatorPage })),
);
const GamePage = lazy(() =>
  import("@/pages/GamePage").then((m) => ({ default: m.GamePage })),
);
const CoverFlowV2Page = lazy(() =>
  import("@/pages/CoverFlowV2Page").then((m) => ({
    default: m.CoverFlowV2Page,
  })),
);
const MobileCarouselPage = lazy(() =>
  import("@/pages/MobileCarouselPage").then((m) => ({
    default: m.MobileCarouselPage,
  })),
);
const PreLoaderPage = lazy(() =>
  import("@/pages/PreLoaderPage").then((m) => ({ default: m.PreLoaderPage })),
);
const PhotoScratchPage = lazy(() =>
  import("@/pages/PhotoScratchPage").then((m) => ({
    default: m.PhotoScratchPage,
  })),
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const FollowingPage = lazy(() =>
  import("@/pages/FollowingPage").then((m) => ({ default: m.FollowingPage })),
);
const GameSettingsPage = lazy(() =>
  import("@/pages/GameSettingsPage").then((m) => ({
    default: m.GameSettingsPage,
  })),
);
const PurchaseFlowPage = lazy(() =>
  import("@/pages/PurchaseFlowPage").then((m) => ({
    default: m.PurchaseFlowPage,
  })),
);
const RecCompletePage = lazy(() =>
  import("@/pages/RecCompletePage").then((m) => ({
    default: m.RecCompletePage,
  })),
);
const WelcomePage = lazy(() =>
  import("@/pages/WelcomePage").then((m) => ({ default: m.WelcomePage })),
);
const RecIntroPage = lazy(() =>
  import("@/pages/RecIntroPage").then((m) => ({ default: m.RecIntroPage })),
);
const RecSwipePage = lazy(() =>
  import("@/pages/RecSwipePage").then((m) => ({ default: m.RecSwipePage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  })),
);
const RewardsPage = lazy(() =>
  import("@/pages/RewardsPage").then((m) => ({ default: m.RewardsPage })),
);
const ChangePasswordPage = lazy(() =>
  import("@/pages/ChangePasswordPage").then((m) => ({
    default: m.ChangePasswordPage,
  })),
);
const EditProfilePage = lazy(() =>
  import("@/pages/EditProfilePage").then((m) => ({
    default: m.EditProfilePage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const StorePage = lazy(() =>
  import("@/pages/StorePage").then((m) => ({ default: m.StorePage })),
);
const InboxPage = lazy(() =>
  import("@/pages/InboxPage").then((m) => ({ default: m.InboxPage })),
);
const CartPage = lazy(() =>
  import("@/pages/CartPage").then((m) => ({ default: m.CartPage })),
);
const TransactionHistoryPage = lazy(() =>
  import("@/pages/TransactionHistoryPage").then((m) => ({
    default: m.TransactionHistoryPage,
  })),
);
const GameHistoryPage = lazy(() =>
  import("@/pages/GameHistoryPage").then((m) => ({
    default: m.GameHistoryPage,
  })),
);

function GameCatalogRoute({ children }: { children: ReactNode }) {
  return <CatalogProvider>{children}</CatalogProvider>;
}

function ResetQueryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const needsReset = params.has("reset") || params.has("token");
    if (needsReset && location.pathname !== Paths.resetPassword) {
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
      <Suspense fallback={<RouteChunkFallback />}>
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
            {/* Home nav → pack browse at root (guest + signed-in); Discover → feed */}
            <Route index element={<BrowsePage />} />
            <Route path="discover" element={<HomeFeedPage />} />
            {/* Legacy paths → root Home */}
            <Route path="browse" element={<Navigate to={Paths.home} replace />} />
            <Route
              path="loggedInHome"
              element={<Navigate to={Paths.home} replace />}
            />
            {/* Deep-link: land on Home and open the global search overlay. */}
            <Route
              path="search"
              element={
                <Navigate
                  to={Paths.homeSearch}
                  replace
                  state={{ openPackLibrary: true }}
                />
              }
            />
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
              path="profile/change-password"
              element={
                <SoftGate tab="profile">
                  <ChangePasswordPage />
                </SoftGate>
              }
            />
            <Route
              path="settings/change-password"
              element={<Navigate to={Paths.changePassword} replace />}
            />
            <Route
              path="settings"
              element={
                <SoftGate tab="profile">
                  <SettingsPage />
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
              path="purchase/tear-open"
              element={
                <CatalogProvider>
                  <PurchaseFlowPage />
                </CatalogProvider>
              }
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
              path="mobile-carousel"
              element={
                <CatalogProvider>
                  <MobileCarouselPage />
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
      </Suspense>
    </>
  );
}
