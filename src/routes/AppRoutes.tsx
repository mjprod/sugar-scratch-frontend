import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppShell, OnboardShell } from "@/components/layout/Shell";
import { SoftGate } from "@/routes/SoftGate";
import { Paths } from "@/routes/Paths";
import { BrowsePage } from "@/pages/BrowsePage";
import { CollectionPage } from "@/pages/CollectionPage";
import { CreatorPage } from "@/pages/CreatorPage";
import { HomeFeedPage } from "@/pages/HomeFeedPage";
import { LoadingPage } from "@/pages/LoadingPage";
import { NavTestPage } from "@/pages/NavTestPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PurchaseFlowPage } from "@/pages/PurchaseFlowPage";
import { RecCompletePage } from "@/pages/RecCompletePage";
import { RecIntroPage } from "@/pages/RecIntroPage";
import { RecSwipePage } from "@/pages/RecSwipePage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { RewardsPage } from "@/pages/RewardsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StorePage } from "@/pages/StorePage";
import { InboxPage } from "@/pages/InboxPage";

const BOOT_KEY = "sugar.v8.bootShown";

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

function BootRedirect() {
  const location = useLocation();
  try {
    const shown = sessionStorage.getItem(BOOT_KEY) === "1";
    if (
      !shown &&
      location.pathname === Paths.home &&
      !new URLSearchParams(location.search).has("reset")
    ) {
      return <Navigate to={Paths.loading} replace />;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AppRoutes() {
  return (
    <>
      <ResetQueryRedirect />
      <BootRedirect />
      <Routes>
        <Route
          path={Paths.loading}
          element={
            <AppShell label="Loading">
              <LoadingPage />
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
            <OnboardShell badge="Recommend · Swipe">
              <RecSwipePage />
            </OnboardShell>
          }
        />
        <Route
          path={Paths.recommendDone}
          element={
            <OnboardShell badge="Recommend · Ready">
              <RecCompletePage />
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
          <Route index element={<HomeFeedPage />} />
          <Route path="browse" element={<BrowsePage />} />
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
            path="store"
            element={
              <SoftGate tab="hub" action={{ type: "store" }}>
                <StorePage />
              </SoftGate>
            }
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
              <SoftGate tab="hub" action={{ type: "inbox" }}>
                <InboxPage />
              </SoftGate>
            }
          />
          <Route path="purchase/:packId" element={<PurchaseFlowPage />} />
        </Route>

        <Route path="*" element={<Navigate to={Paths.home} replace />} />
      </Routes>
    </>
  );
}
