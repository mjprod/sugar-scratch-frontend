import { useEffect } from "react";
import { Search } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthenticationSheet } from "@/components/auth/AuthenticationSheet";
import { VerifyEmailModal } from "@/components/auth/VerifyEmailModal";
import { PacksButton } from "@/components/InboxButton";
import { LiquidGlassNav } from "@/components/LiquidGlassNav";
import { MobileDiamondUtility } from "@/components/MobileDiamondBalance";
import { PackAddedToast } from "@/components/ui/PackAddedToast";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { useWallet } from "@/contexts/WalletContext";
import { bindGameNavigate } from "@/features/game/modules/gameSession";
import { useTabNav } from "@/hooks/useTabNav";
import { triggerFromAction } from "@/services/auth";
import { countUnread, fetchInboxMessages } from "@/services/inbox";
import {
  PACK_OPENING_REWARD_EVENT,
  type PackOpeningRewardDetail,
} from "@/services/packMotionSettle";

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
    openCart,
    completeAuth,
    dismissAuth,
    onVerified,
    onVerifyBack,
    verifyFromRegister,
    verifyEmail,
    setInboxUnread,
    invalidateRemoteSession,
    setPurchasedPacks,
    bumpInventoryRevision,
  } = useAuth();
  const { coins, diamonds, addCoins, setCoins, setDiamonds } = useWallet();
  const { searchOpen, openSearch } = useSearch();
  const { activeTab: tab, requestTab } = useTabNav();

  useEffect(() => {
    bindGameNavigate((to) => {
      navigate(to);
    });
    return () => bindGameNavigate(null);
  }, [navigate]);

  const isPurchase = location.pathname.startsWith("/purchase");
  const isTearOpen = location.pathname.startsWith("/purchase/tear-open");

  useEffect(() => {
    function onPackOpeningReward(event: Event) {
      const detail = (event as CustomEvent<PackOpeningRewardDetail>).detail;
      const rewardCoins = detail?.coins ?? 0;
      const rewardCards = detail?.cards ?? 0;
      if (detail?.wallet) {
        setDiamonds(detail.wallet.diamonds);
        setCoins(detail.wallet.coins);
      } else if (rewardCoins > 0) {
        addCoins(rewardCoins);
      }
      if (rewardCards > 0) {
        setPurchasedPacks((count) => count + rewardCards);
      }
      if (detail?.wallet || rewardCoins > 0 || rewardCards > 0) {
        bumpInventoryRevision();
      }
    }
    window.addEventListener(PACK_OPENING_REWARD_EVENT, onPackOpeningReward);
    return () => {
      window.removeEventListener(PACK_OPENING_REWARD_EVENT, onPackOpeningReward);
    };
  }, [
    addCoins,
    bumpInventoryRevision,
    setCoins,
    setDiamonds,
    setPurchasedPacks,
  ]);

  const hideChrome =
    location.pathname.startsWith("/recommend") ||
    location.pathname.startsWith("/welcome") ||
    location.pathname.startsWith("/game") ||
    location.pathname.startsWith("/game-ui") ||
    location.pathname.startsWith("/photo-scratch");

  const onPackPocket =
    location.pathname.startsWith("/pack-pocket") ||
    location.pathname.startsWith("/cart");
  const onSearch = searchOpen;

  const showTopUtility =
    !hideChrome &&
    !location.pathname.startsWith("/creator");

  const showNav =
    !hideChrome &&
    !location.pathname.startsWith("/settings");

  useEffect(() => {
    if (guest) {
      setInboxUnread(0);
      return;
    }
    let cancelled = false;
    void fetchInboxMessages().then((result) => {
      if (cancelled) return;
      if (result.status === "unauthorized") {
        invalidateRemoteSession();
        return;
      }
      setInboxUnread(countUnread(result.messages));
    });
    return () => {
      cancelled = true;
    };
  }, [guest, invalidateRemoteSession, setInboxUnread]);

  const mobileTrailing = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search"
        aria-pressed={onSearch}
        data-top-nav-target="search"
        className={[
          // AC23: ≥44×44 touch target
          "inbox-utility-btn inbox-utility-btn--ghost relative grid size-11 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/85 active:scale-95",
          onSearch ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Search className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <PacksButton
        onOpen={openCart}
        variant="ghost"
        active={onPackPocket}
        data-top-nav-target="pack-pocket"
      />
    </div>
  );

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
          onOpenHome={() => requestTab("feed")}
          onOpenPackPocket={openCart}
          onOpenSearch={openSearch}
          packsActive={onPackPocket}
          searchActive={onSearch}
          visible
          trailing={mobileTrailing}
        />
      ) : null}

      <div
        className={[
          "relative flex min-h-0 flex-1 flex-col overflow-hidden",
          hideChrome ? "app-layout__immersive" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Outlet />
      </div>

      <PackAddedToast />

      {showNav ? (
        <LiquidGlassNav
          activeTab={tab}
          onTabChange={requestTab}
          coins={guest ? null : coins}
          diamonds={guest ? null : diamonds}
          // Desktop top bar stays on creator (no primary tab selected); keep
          // Store / Pack Pocket / Search wired even when mobile HUD is hidden.
          onOpenStore={openStore}
          onOpenUnopenedPacks={openCart}
          onOpenSearch={openSearch}
          packsActive={onPackPocket}
          searchActive={onSearch}
          hideDock={isPurchase && !isTearOpen}
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
        fromRegister={verifyFromRegister}
        onBack={onVerifyBack}
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
