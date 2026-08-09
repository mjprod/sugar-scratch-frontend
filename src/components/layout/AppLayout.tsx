import { Outlet, useLocation } from "react-router-dom";
import { AuthenticationSheet } from "@/components/auth/AuthenticationSheet";
import { VerifyEmailModal } from "@/components/auth/VerifyEmailModal";
import { FooterNav } from "@/components/FooterNav";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useTabNav } from "@/hooks/useTabNav";
import { triggerFromAction } from "@/services/auth";

/** Main product chrome: top nav + outlet + footer + auth/verify overlays. */
export function AppLayout() {
  const location = useLocation();
  const {
    guest,
    profile,
    authOpen,
    pending,
    verifyOpen,
    navNotice,
    purchasedPacks,
    openStore,
    openSettings,
    completeAuth,
    dismissAuth,
    onVerified,
    onVerifyLater,
    onEmailChanged,
    logout,
    verifyEmail,
    setNavNotice,
  } = useAuth();
  const { coins, diamonds } = useWallet();
  const { activeTab: tab, requestTab } = useTabNav();

  const hideChrome =
    location.pathname.startsWith("/purchase") ||
    location.pathname.startsWith("/recommend");

  const showTopNav =
    !hideChrome &&
    !location.pathname.startsWith("/settings") &&
    !location.pathname.startsWith("/store") &&
    !location.pathname.startsWith("/creator");

  const showFooter = !hideChrome && !location.pathname.startsWith("/settings");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {showTopNav ? (
        <TopNav
          coins={guest ? 0 : coins}
          diamonds={guest ? 0 : diamonds}
          activeTab={tab}
          onTabChange={requestTab}
          onProfile={() => requestTab("profile")}
          onSettings={openSettings}
          onOpenStore={openStore}
          onSearch={() => {
            setNavNotice(
              tab === "feed"
                ? "Browse search is ready"
                : "Collection search is ready",
            );
            window.setTimeout(() => setNavNotice(""), 1800);
          }}
        />
      ) : null}

      <Outlet />

      {showFooter ? (
        <FooterNav
          active={tab}
          visible
          onChange={requestTab}
          bagBadge={
            !guest &&
            (profile.welcomeClaimed || purchasedPacks > 0) &&
            tab !== "bag"
              ? { type: "dot" as const }
              : undefined
          }
        />
      ) : null}

      <AuthenticationSheet
        open={authOpen}
        trigger={triggerFromAction(pending)}
        onDismiss={dismissAuth}
        onSuccess={completeAuth}
      />

      <VerifyEmailModal
        open={verifyOpen}
        email={verifyEmail}
        onLater={onVerifyLater}
        onEmailChanged={onEmailChanged}
        onVerified={onVerified}
      />

      {navNotice ? (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[13px] backdrop-blur-md">
          {navNotice}
        </div>
      ) : null}

      {!guest && location.pathname.startsWith("/profile") ? (
        <button type="button" className="auth7-logout-fab" onClick={logout}>
          Log out
        </button>
      ) : null}
    </div>
  );
}
