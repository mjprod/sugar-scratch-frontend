import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { PagePushStage } from "@/components/layout/PagePushStage";
// The auth sheet is lazy, but its CTA styles must keep their entry-CSS slot
// ahead of LiquidGlassNav.css / theme.css or equal-specificity rules flip.
// BorderGlow.css must stay after CtaButton.css (ties on .border-glow-card).
import "@/components/cta/CtaButton.css";
import { PacksButton } from "@/components/InboxButton";
import { LiquidGlassNav } from "@/components/LiquidGlassNav";
import { MobileDiamondUtility } from "@/components/MobileDiamondBalance";
import { ChunkErrorBoundary } from "@/components/ui/ChunkErrorBoundary";
import { PackAddedToast } from "@/components/ui/PackAddedToast";
import { useAuth } from "@/contexts/useAuth";
import { useSearch } from "@/contexts/SearchContext";
import { useWallet } from "@/contexts/WalletContext";
import { bindGameNavigate } from "@/services/gameSessionStore";
import { runWhenIdle } from "@/lib/idle";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
import { prefetchTabPages } from "@/routes/lazyPages";
import { RouteLoadError } from "@/routes/RouteChunkFallback";
import { useTabNav } from "@/hooks/useTabNav";
import { triggerFromAction } from "@/services/auth";
import { noteCoinsReceived } from "@/services/coinReceipt";
import { countUnread, fetchInboxMessages } from "@/services/inbox";
import {
  PACK_OPENING_REWARD_EVENT,
  type PackOpeningRewardDetail,
} from "@/services/packMotionSettle";

const loadAuthenticationSheet = () =>
  import("@/components/auth/AuthenticationSheet").then((mod) => ({
    default: mod.AuthenticationSheet,
  }));
const loadVerifyEmailModal = () =>
  import("@/components/auth/VerifyEmailModal").then((mod) => ({
    default: mod.VerifyEmailModal,
  }));
const AuthenticationSheet = lazy(loadAuthenticationSheet);
const VerifyEmailModal = lazy(loadVerifyEmailModal);

function prefetchAuthOverlays(): void {
  void loadAuthenticationSheet().catch(() => {});
  void loadVerifyEmailModal().catch(() => {});
}

const FIRST_INTERACTION_EVENTS = ["pointerdown", "keydown"] as const;

/** Shown while an overlay chunk loads so a gated tap never looks ignored. */
function OverlayLoading({ label, onDismiss }: { label: string; onDismiss?: () => void }) {
  return (
    <div className="auth7-sheet-root" role="presentation">
      <button
        type="button"
        className="auth7-sheet-backdrop"
        aria-label={label}
        disabled={!onDismiss}
        onClick={onDismiss}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <Loader2
          className="size-8 animate-spin text-white/70"
          role="status"
          aria-label="Loading"
        />
      </div>
    </div>
  );
}

/** Shown when an overlay chunk failed to download; only a reload can retry it. */
function OverlayLoadError({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="auth7-sheet-root" role="presentation">
      <button
        type="button"
        className="auth7-sheet-backdrop"
        aria-label="Dismiss"
        disabled={!onDismiss}
        onClick={onDismiss}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-8">
        <div className="pointer-events-auto rounded-3xl bg-black/80 backdrop-blur-md">
          <RouteLoadError />
        </div>
      </div>
    </div>
  );
}

/** True from the first render where `flag` is true, forever after (keeps exit animations). */
function useLatched(flag: boolean): boolean {
  const [latched, setLatched] = useState(flag);
  useEffect(() => {
    if (flag) setLatched(true);
  }, [flag]);
  return latched || flag;
}

/** Main product chrome: liquid-glass nav + outlet + auth/verify overlays. */
export function AppLayout() {
  const location = useLocation();
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
  const { coins, diamonds, addCoins, addDiamonds, setCoins, setDiamonds } = useWallet();
  const { searchOpen, openSearch } = useSearch();
  const { activeTab: tab, requestTab } = useTabNav();

  const authMounted = useLatched(authOpen);
  const verifyMounted = useLatched(verifyOpen);

  useEffect(() => runWhenIdle(prefetchTabPages, 4000), []);
  useEffect(() => runWhenIdle(prefetchAuthOverlays, 4000), []);

  // A tab's pointerdown lands before its click, so the first tap on Discover /
  // Rank (before the idle prefetch) still gets a head start on the chunk.
  useEffect(() => {
    const prefetch = () => {
      for (const type of FIRST_INTERACTION_EVENTS) {
        window.removeEventListener(type, prefetch, true);
      }
      prefetchTabPages();
    };
    for (const type of FIRST_INTERACTION_EVENTS) {
      window.addEventListener(type, prefetch, { capture: true, passive: true });
    }
    return () => {
      for (const type of FIRST_INTERACTION_EVENTS) {
        window.removeEventListener(type, prefetch, true);
      }
    };
  }, []);

  // A guest's pointerdown lands before the click that opens the sheet.
  useEffect(() => {
    if (!guest) return;
    const prefetch = () => {
      for (const type of FIRST_INTERACTION_EVENTS) {
        window.removeEventListener(type, prefetch, true);
      }
      prefetchAuthOverlays();
    };
    for (const type of FIRST_INTERACTION_EVENTS) {
      window.addEventListener(type, prefetch, { capture: true, passive: true });
    }
    return () => {
      for (const type of FIRST_INTERACTION_EVENTS) {
        window.removeEventListener(type, prefetch, true);
      }
    };
  }, [guest]);

  useEffect(() => {
    bindGameNavigate((to) => {
      // Fade-to-black + purge when crossing packs/game domains.
      memoryNavigate(to);
    });
    return () => bindGameNavigate(null);
  }, []);

  const isPurchase = location.pathname.startsWith("/purchase");
  const isTearOpen = location.pathname.startsWith("/purchase/tear-open");

  useEffect(() => {
    function onPackOpeningReward(event: Event) {
      const detail = (event as CustomEvent<PackOpeningRewardDetail>).detail;
      const rewardCoins = detail?.coins ?? 0;
      const rewardDiamonds = detail?.diamonds ?? 0;
      const rewardCards = detail?.cards ?? 0;
      if (detail?.wallet) {
        setDiamonds(detail.wallet.diamonds);
        setCoins(detail.wallet.coins);
      } else {
        if (rewardCoins > 0) addCoins(rewardCoins);
        if (rewardDiamonds > 0) addDiamonds(rewardDiamonds);
      }
      if (rewardCoins > 0) noteCoinsReceived(rewardCoins);
      if (rewardCards > 0) {
        setPurchasedPacks((count) => count + rewardCards);
      }
      if (
        detail?.wallet ||
        rewardCoins > 0 ||
        rewardDiamonds > 0 ||
        rewardCards > 0
      ) {
        bumpInventoryRevision();
      }
    }
    window.addEventListener(PACK_OPENING_REWARD_EVENT, onPackOpeningReward);
    return () => {
      window.removeEventListener(PACK_OPENING_REWARD_EVENT, onPackOpeningReward);
    };
  }, [
    addCoins,
    addDiamonds,
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
    location.pathname.startsWith("/photo-scratch") ||
    location.pathname.startsWith("/audio-test");

  const onPackPocket =
    location.pathname.startsWith("/pack-pocket") ||
    location.pathname.startsWith("/cart");
  const onSearch = searchOpen;

  const showTopUtility = !hideChrome;

  const showNav =
    !hideChrome &&
    !location.pathname.startsWith("/settings");

  // Android-only: Chrome's bottom toolbar overlays the layout viewport while
  // safe-area stays 0. Safari/iOS keep the pre-fix stage (100dvh + safe-area).
  useEffect(() => {
    if (!hideChrome || typeof window === "undefined") return;

    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    if (!isAndroid) return;

    const root = document.documentElement;
    root.dataset.gameAndroid = "1";

    const publish = () => {
      const vv = window.visualViewport;
      const h = Math.round(vv?.height || window.innerHeight || 0);
      const top = Math.round(vv?.offsetTop || 0);
      if (h > 0) {
        root.style.setProperty("--game-vv-height", `${h}px`);
      }
      root.style.setProperty("--game-vv-top", `${top}px`);
    };

    publish();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", publish);
    vv?.addEventListener("scroll", publish);
    window.addEventListener("resize", publish);
    window.addEventListener("orientationchange", publish);
    return () => {
      vv?.removeEventListener("resize", publish);
      vv?.removeEventListener("scroll", publish);
      window.removeEventListener("resize", publish);
      window.removeEventListener("orientationchange", publish);
      root.style.removeProperty("--game-vv-height");
      root.style.removeProperty("--game-vv-top");
      delete root.dataset.gameAndroid;
    };
  }, [hideChrome]);

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
          "inbox-utility-btn inbox-utility-btn--ghost relative grid size-11 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-white/55 transition hover:bg-white/6 hover:text-white/85 active:scale-95",
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
          onOpenHome={() => requestTab(guest ? "feed" : "bag")}
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
        <ChunkErrorBoundary resetKey={location.pathname} fallback={<RouteLoadError />}>
          <PagePushStage />
        </ChunkErrorBoundary>
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

      {authMounted ? (
        <ChunkErrorBoundary
          fallback={authOpen ? <OverlayLoadError onDismiss={dismissAuth} /> : null}
        >
          <Suspense
            fallback={
              authOpen ? (
                <OverlayLoading label="Dismiss authentication" onDismiss={dismissAuth} />
              ) : null
            }
          >
            <AuthenticationSheet
              open={authOpen}
              trigger={triggerFromAction(pending)}
              initialMode={authSheetMode}
              initialEmail={authSheetEmail}
              onDismiss={dismissAuth}
              onSuccess={completeAuth}
            />
          </Suspense>
        </ChunkErrorBoundary>
      ) : null}

      {verifyMounted ? (
        <ChunkErrorBoundary fallback={verifyOpen ? <OverlayLoadError /> : null}>
          <Suspense
            fallback={verifyOpen ? <OverlayLoading label="Verification required" /> : null}
          >
            <VerifyEmailModal
              open={verifyOpen}
              email={verifyEmail}
              fromRegister={verifyFromRegister}
              onBack={onVerifyBack}
              onVerified={onVerified}
            />
          </Suspense>
        </ChunkErrorBoundary>
      ) : null}

      {navNotice ? (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[13px] backdrop-blur-md">
          {navNotice}
        </div>
      ) : null}
    </div>
  );
}
