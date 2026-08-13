import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthenticationSheet } from "@/components/auth/AuthenticationSheet";
import { VerifyEmailModal } from "@/components/auth/VerifyEmailModal";
import { FooterNav } from "@/components/FooterNav";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { bindGameNavigate } from "@/features/game/modules/gameSession";
import { useTabNav } from "@/hooks/useTabNav";
import { triggerFromAction } from "@/services/auth";
import { countUnread, INBOX_FIXTURES } from "@/services/inbox";

/** Main product chrome: top nav + outlet + footer + auth/verify overlays. */
export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    guest,
    profile,
    authOpen,
    authSheetMode,
    authSheetEmail,
    pending,
    verifyOpen,
    navNotice,
    purchasedPacks,
    openStore,
    openInbox,
    completeAuth,
    dismissAuth,
    onVerified,
    onVerifyLater,
    onEmailChanged,
    verifyEmail,
  } = useAuth();
  const { coins, diamonds } = useWallet();
  const { activeTab: tab, requestTab } = useTabNav();

  useEffect(() => {
    bindGameNavigate((to) => {
      navigate(to);
    });
    return () => bindGameNavigate(null);
  }, [navigate]);

  const hideChrome =
    location.pathname.startsWith("/purchase") ||
    location.pathname.startsWith("/recommend") ||
    location.pathname.startsWith("/game") ||
    location.pathname.startsWith("/photo-scratch");

  const onInbox = location.pathname.startsWith("/inbox");
  const onStore = location.pathname.startsWith("/store");
  const onSettings = location.pathname.startsWith("/settings");
  const secondaryUtility = onInbox || onStore || onSettings;

  const showTopNav =
    !hideChrome &&
    !location.pathname.startsWith("/creator");

  const showFooter = !hideChrome;

  const inboxUnread = guest ? 0 : countUnread(INBOX_FIXTURES);

  return (
    <div
      className={[
        "relative flex min-h-0 flex-1 flex-col",
        showTopNav ? "app-layout--hud" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showTopNav ? (
        <TopNav
          coins={guest ? null : coins}
          diamonds={guest ? null : diamonds}
          activeTab={tab}
          onTabChange={requestTab}
          onProfile={() => requestTab("profile")}
          onOpenStore={openStore}
          onOpenInbox={openInbox}
          inboxUnreadCount={inboxUnread}
          inboxActive={onInbox}
          storeActive={onStore}
          settingsActive={onSettings}
          profileActive={location.pathname.startsWith("/profile")}
          showMobileDiamond={!secondaryUtility}
          routeKey={location.pathname}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>

      {showFooter ? (
        <FooterNav
          active={secondaryUtility ? null : tab}
          visible
          onChange={requestTab}
          bagBadge={
            !guest &&
            (profile.welcomeClaimed || purchasedPacks > 0) &&
            !secondaryUtility &&
            tab !== "bag"
              ? { type: "dot" as const }
              : undefined
          }
        />
      ) : null}

      <AuthenticationSheet
        open={authOpen}
        trigger={triggerFromAction(pending)}
        initialMode={authSheetMode}
        initialEmail={authSheetEmail}
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
    </div>
  );
}
