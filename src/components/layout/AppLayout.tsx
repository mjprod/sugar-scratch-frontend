import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthenticationSheet } from "@/components/auth/AuthenticationSheet";
import { VerifyEmailModal } from "@/components/auth/VerifyEmailModal";
import { InboxButton } from "@/components/InboxButton";
import { LiquidGlassNav } from "@/components/LiquidGlassNav";
import { MobileDiamondUtility } from "@/components/MobileDiamondBalance";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { bindGameNavigate } from "@/features/game/modules/gameSession";
import { useTabNav } from "@/hooks/useTabNav";
import { triggerFromAction } from "@/services/auth";
import { countUnread, fetchInboxMessages } from "@/services/inbox";

/** Main product chrome: liquid-glass nav + outlet + auth/verify overlays. */
export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    guest,
    authOpen,
    authSheetMode,
    authSheetEmail,
    pending,
    verifyOpen,
    navNotice,
    openStore,
    openInbox,
    completeAuth,
    dismissAuth,
    onVerified,
    onVerifyLater,
    onEmailChanged,
    verifyEmail,
    inboxUnread,
    setInboxUnread,
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

  const showTopUtility =
    !hideChrome &&
    !location.pathname.startsWith("/creator");

  const showNav =
    !hideChrome &&
    !location.pathname.startsWith("/settings") &&
    !onInbox;

  useEffect(() => {
    if (guest) {
      setInboxUnread(0);
      return;
    }
    void fetchInboxMessages().then((messages) => {
      setInboxUnread(countUnread(messages));
    });
  }, [guest, setInboxUnread]);

  const mobileInbox = openInbox ? (
    <InboxButton
      unreadCount={inboxUnread}
      onOpen={openInbox}
      variant="ghost"
    />
  ) : null;

  return (
    <div
      className={[
        "relative flex min-h-0 flex-1 flex-col",
        showTopUtility ? "app-layout--hud" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showTopUtility ? (
        <MobileDiamondUtility
          coins={guest ? null : coins}
          balance={guest ? null : diamonds}
          onOpenStore={openStore}
          onOpenHome={() => requestTab("home")}
          visible
          trailing={mobileInbox}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>

      {showNav ? (
        <LiquidGlassNav
          activeTab={tab}
          onTabChange={requestTab}
          coins={guest ? null : coins}
          diamonds={guest ? null : diamonds}
          onOpenStore={showTopUtility ? openStore : undefined}
          onOpenInbox={showTopUtility ? openInbox : undefined}
          inboxUnreadCount={inboxUnread}
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
