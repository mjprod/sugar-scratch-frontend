import { Outlet, useLocation } from "react-router-dom";
import { AuthenticationSheet } from "@/components/auth/AuthenticationSheet";
import { VerifyEmailModal } from "@/components/auth/VerifyEmailModal";
import { FooterNav } from "@/components/FooterNav";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useTabNav } from "@/hooks/useTabNav";
import { triggerFromAction } from "@/services/auth";
import { countUnread, INBOX_FIXTURES } from "@/services/inbox";

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

  const hideChrome =
    location.pathname.startsWith("/purchase") ||
    location.pathname.startsWith("/recommend");

  const onInbox = location.pathname.startsWith("/inbox");

  const showTopNav =
    !hideChrome &&
    !location.pathname.startsWith("/settings") &&
    !location.pathname.startsWith("/store") &&
    !onInbox &&
    !location.pathname.startsWith("/creator");

  const showFooter =
    !hideChrome &&
    !location.pathname.startsWith("/settings") &&
    !onInbox;

  const inboxUnread = guest ? 0 : countUnread(INBOX_FIXTURES);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
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
    </div>
  );
}
