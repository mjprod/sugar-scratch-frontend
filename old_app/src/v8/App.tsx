import { useCallback, useEffect, useState } from "react";
import { AuthenticationSheet } from "./components/auth/AuthenticationSheet";
import { VerifyEmailModal } from "./components/auth/VerifyEmailModal";
import { FooterNav } from "./components/FooterNav";
import { SiteShell } from "./components/PhoneShell";
import { TopNav } from "./components/TopNav";
import {
  clearEmailVerified,
  createSession,
  destroySession,
  getAuthEmail,
  isAuthenticated,
  isEmailVerified,
  markEmailVerified,
  needsEmailVerification,
  triggerFromAction,
  type AuthSuccessResult,
  type ProtectedAction,
} from "./flow/auth";
import {
  clearRecommendationState,
  evaluateRecommendationEligibility,
  isRecommendationInitialized,
  markRecommendationBehaviorSeeded,
  markRecommendationExplicitCompleted,
  markRecommendationExplicitInProgress,
  markRecommendationSkipped,
  noteCreatorEngagement,
  saveSwipePreferences,
  setRecommendationSeedCreator,
} from "./flow/recommendation";
import { clearHomeFeedCache } from "./flow/creatorFeed";
import {
  clearV8Session,
  markEntered,
  markOnboardingDone,
  type AppOverlay,
  type AppTab,
  type OnboardingData,
  type Step,
} from "./flow/types";
import type { PurchaseFlowPack } from "./flow/purchase";
import { CollectionScreen } from "./screens/CollectionScreen";
import { CreatorScreen } from "./screens/CreatorScreen";
import { HomeFeedScreen } from "./screens/HomeFeedScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { HubScreen } from "./screens/HubScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { PersonalizationCompleteScreen } from "./screens/PersonalizationCompleteScreen";
import { PersonalizationSwipeScreen } from "./screens/PersonalizationSwipeScreen";
import { RecommendationIntroScreen } from "./screens/RecommendationIntroScreen";
import { PurchaseFlow } from "./screens/PurchaseFlow";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StoreScreen } from "./screens/StoreScreen";
import { UserDashboardScreen } from "./screens/UserDashboardScreen";

const initialData: OnboardingData = {
  email: "",
  password: "",
  username: "",
  displayName: "",
  avatar: null,
  genderInterest: null,
  likedCreators: [],
  passedCreators: [],
  welcomeClaimed: false,
  referralCode: "",
  referralApplied: false,
  homeTutorialDone: true,
  coins: 120,
  diamonds: 3,
};

const PUBLIC_TABS: AppTab[] = ["home", "feed"];

function actionNeedsVerifiedEmail(action: ProtectedAction) {
  if (action.type === "buy") return true;
  if (action.type === "tab" && action.tab === "hub") return true;
  return false;
}

/**
 * Sugar Spec v8.0 — Authentication + Adaptive Recommendation
 * Ask only when behaviour has not already answered. Purchase → behavior-seeded.
 */
export default function V8App() {
  const [step, setStep] = useState<Step>(() => {
    try {
      return new URLSearchParams(window.location.search).has("reset")
        ? "reset-password"
        : "loading";
    } catch {
      return "loading";
    }
  });
  const [data, setData] = useState<OnboardingData>(initialData);
  const [tab, setTab] = useState<AppTab>("home");
  const [overlay, setOverlay] = useState<AppOverlay>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [purchaseFlow, setPurchaseFlow] = useState<PurchaseFlowPack | null>(null);
  const [purchasedPacks, setPurchasedPacks] = useState(0);
  const [navNotice, setNavNotice] = useState("");
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState<ProtectedAction | null>(null);
  const [resumeLikeId, setResumeLikeId] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(() => isEmailVerified());
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPending, setVerifyPending] = useState<ProtectedAction | null>(
    null,
  );
  /** Low-intent pending resumed after Recommendation Initialization. */
  const [pendingAfterRec, setPendingAfterRec] =
    useState<ProtectedAction | null>(null);

  const go = useCallback((next: Step) => setStep(next), []);
  const guest = !authed;

  function finishRecommendationAndResume() {
    const deferred = pendingAfterRec;
    setPendingAfterRec(null);
    setTab("home");
    go("app");
    if (deferred) {
      window.setTimeout(() => resumePending(deferred), 0);
    }
  }

  /** Sole path that may open Recommendation Initialization (Spec §29). */
  function applyRecommendationDecision(
    pendingAction: ProtectedAction | null,
  ) {
    const decision = evaluateRecommendationEligibility({
      pending: pendingAction,
    });

    if (decision.action === "launch-initialization") {
      if (pendingAction && !isHighIntentForDefer(pendingAction)) {
        setPendingAfterRec(pendingAction);
      }
      setOverlay(null);
      setCreatorId(null);
      setPurchaseFlow(null);
      setTab("home");
      go("recommend-intro");
      return;
    }

    resumePending(pendingAction);
  }

  function isHighIntentForDefer(action: ProtectedAction) {
    return action.type === "buy" || (action.type === "tab" && action.tab === "hub");
  }

  function applyUserFromEmail(email: string) {
    const local = email.split("@")[0] || "collector";
    const username =
      local.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "collector";
    setData((d) => ({
      ...d,
      email,
      username: d.username || username,
      displayName: d.displayName || d.username || username,
      avatar: d.avatar || "✨",
      homeTutorialDone: true,
    }));
  }

  function resumePending(action: ProtectedAction | null) {
    if (!action) return;
    if (action.type === "buy") {
      if (action.pack.creator) setRecommendationSeedCreator(action.pack.creator);
      setPurchaseFlow(action.pack);
      return;
    }
    if (action.type === "like") {
      setResumeLikeId(action.feedItemId);
      setTab("home");
      return;
    }
    if (action.type === "scratch") {
      return;
    }
    if (action.type === "tab") {
      setTab(action.tab);
      setCreatorId(null);
      setOverlay(null);
      if (action.tab === "hub") {
        setPurchaseFlow(null);
        setOverlay("store");
      }
    }
  }

  function completeAuth(result: AuthSuccessResult) {
    const wasUnresolved = !isRecommendationInitialized();
    const action = pending;
    createSession(result.email, result.provider);
    applyUserFromEmail(result.email);
    markEntered();
    markOnboardingDone();
    setAuthOpen(false);
    setAuthed(true);
    setEmailVerified(isEmailVerified());

    if (result.provider === "email" && wasUnresolved) {
      clearEmailVerified();
      setEmailVerified(false);
    }

    setPending(null);
    go("app");
    window.setTimeout(() => {
      if (
        action &&
        actionNeedsVerifiedEmail(action) &&
        needsEmailVerification()
      ) {
        setVerifyPending(action);
        setVerifyOpen(true);
        return;
      }
      applyRecommendationDecision(action);
    }, 0);
  }

  function dismissAuth() {
    setAuthOpen(false);
    setPending(null);
  }

  /** Pack purchase → behavior-seeded (Spec §18 / §40). */
  function notePackPurchaseSeed(creatorName?: string) {
    markRecommendationBehaviorSeeded(creatorName);
  }

  function requireAuth(action: ProtectedAction) {
    if (authed || isAuthenticated()) {
      if (actionNeedsVerifiedEmail(action) && needsEmailVerification()) {
        setVerifyPending(action);
        setVerifyOpen(true);
        return false;
      }
      resumePending(action);
      return true;
    }
    setPending(action);
    setAuthOpen(true);
    return false;
  }

  function requestTab(next: AppTab) {
    if (PUBLIC_TABS.includes(next) || authed) {
      if (next === "hub" && authed) {
        requireAuth({ type: "tab", tab: "hub" });
        return;
      }
      setCreatorId(null);
      setTab(next);
      return;
    }
    requireAuth({ type: "tab", tab: next });
  }

  function openStore() {
    if (!requireAuth({ type: "tab", tab: "hub" })) return;
    setCreatorId(null);
    setPurchaseFlow(null);
    setOverlay("store");
  }

  function restart() {
    clearV8Session();
    clearRecommendationState();
    clearEmailVerified();
    destroySession();
    clearHomeFeedCache();
    setData(initialData);
    setAuthed(false);
    setEmailVerified(false);
    setVerifyOpen(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    setTab("home");
    setOverlay(null);
    setCreatorId(null);
    setPurchaseFlow(null);
    setPurchasedPacks(0);
    setPending(null);
    setAuthOpen(false);
    setStep("loading");
  }

  function logout() {
    destroySession();
    setAuthed(false);
    setOverlay(null);
    setCreatorId(null);
    setPurchaseFlow(null);
    setPending(null);
    setAuthOpen(false);
    setVerifyOpen(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    setTab("home");
    go("app");
    setNavNotice("Signed out — browsing as guest");
    window.setTimeout(() => setNavNotice(""), 1800);
  }

  const coins = data.coins;
  void emailVerified;

  useEffect(() => {
    if (authed && step === "reset-password") go("app");
  }, [authed, step, go]);

  return (
    <SiteShell step={step}>
      {step === "loading" && <LoadingScreen onDone={() => go("app")} />}

      {step === "reset-password" && (
        <ResetPasswordScreen
          onBack={() => go("app")}
          onDone={() => {
            setNavNotice("Password updated successfully.");
            window.setTimeout(() => setNavNotice(""), 2000);
            go("app");
            setAuthOpen(true);
          }}
        />
      )}

      {step === "recommend-intro" && (
        <RecommendationIntroScreen
          onStart={() => {
            markRecommendationExplicitInProgress();
            go("personalize-swipe");
          }}
          onSkip={() => {
            markRecommendationSkipped();
            finishRecommendationAndResume();
          }}
        />
      )}

      {step === "personalize-swipe" && (
        <PersonalizationSwipeScreen
          onContinue={(result) => {
            saveSwipePreferences(result);
            setData((d) => ({
              ...d,
              likedCreators: result.liked,
              passedCreators: result.passed,
            }));
            go("personalize-complete");
          }}
          onSkip={(result) => {
            if (result.liked.length || result.passed.length) {
              saveSwipePreferences(result);
            }
            markRecommendationSkipped();
            finishRecommendationAndResume();
          }}
        />
      )}

      {step === "personalize-complete" && (
        <PersonalizationCompleteScreen
          onStart={() => {
            markRecommendationExplicitCompleted();
            finishRecommendationAndResume();
          }}
        />
      )}

      {step === "app" && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {purchaseFlow ? (
            <PurchaseFlow
              pack={purchaseFlow}
              diamonds={data.diamonds}
              onClose={() => {
                setPurchaseFlow(null);
                setTab("home");
                // Abandoned high-intent buy — re-evaluate cold start via engine only
                if (!isRecommendationInitialized()) {
                  applyRecommendationDecision(null);
                }
              }}
              onSpend={(diamonds) =>
                setData((current) => ({
                  ...current,
                  diamonds: Math.max(0, current.diamonds - diamonds),
                }))
              }
              onComplete={({ cards, coins: rewardCoins }) => {
                setData((current) => ({
                  ...current,
                  coins: current.coins + rewardCoins,
                }));
                setPurchasedPacks((count) => count + cards);
                notePackPurchaseSeed(purchaseFlow.creator);
              }}
              onGetDiamonds={() => {
                setPurchaseFlow(null);
                if (!guest) openStore();
                else requireAuth({ type: "tab", tab: "hub" });
              }}
              onGoHome={() => {
                setPurchaseFlow(null);
                setTab("home");
              }}
              onViewCollection={() => {
                setPurchaseFlow(null);
                requestTab("bag");
              }}
              onGoMyBag={() => {
                setPurchaseFlow(null);
                requestTab("bag");
              }}
            />
          ) : overlay === "settings" ? (
            <SettingsScreen
              onBack={() => setOverlay(null)}
              onReplayTutorials={() => {
                setTab("home");
                setOverlay(null);
              }}
            />
          ) : overlay === "store" ? (
            <>
              <StoreScreen
                coins={coins}
                diamonds={data.diamonds}
                avatar={data.avatar}
                onBack={() => setOverlay(null)}
                onProfile={() => {
                  setOverlay(null);
                  requestTab("profile");
                }}
                onPurchaseSuccess={({ diamonds: gained, coins: gainedCoins }) => {
                  setData((current) => ({
                    ...current,
                    diamonds: current.diamonds + gained,
                    coins: current.coins + gainedCoins,
                  }));
                }}
              />
              <FooterNav
                active={tab}
                visible
                onChange={(next) => {
                  setOverlay(null);
                  requestTab(next);
                }}
              />
            </>
          ) : creatorId ? (
            <>
              <CreatorScreen
                key={creatorId}
                creatorId={creatorId}
                diamonds={data.diamonds}
                onBack={() => setCreatorId(null)}
                onOpenPack={(pack) => {
                  if (pack.creator) noteCreatorEngagement(pack.creator);
                  requireAuth({
                    type: "buy",
                    pack,
                    kind: "open-pack",
                  });
                }}
                onBuyPack={(pack) => {
                  if (pack.creator) noteCreatorEngagement(pack.creator);
                  requireAuth({ type: "buy", pack, kind: "buy-pack" });
                }}
              />
              <FooterNav
                active="bag"
                visible
                onChange={(next) => {
                  setCreatorId(null);
                  requestTab(next);
                }}
              />
            </>
          ) : (
            <>
              <TopNav
                coins={guest ? 0 : coins}
                diamonds={guest ? 0 : data.diamonds}
                activeTab={tab}
                onTabChange={requestTab}
                onProfile={() => requestTab("profile")}
                onSettings={() => {
                  if (guest) requireAuth({ type: "tab", tab: "profile" });
                  else setOverlay("settings");
                }}
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
              <div
                className={
                  tab === "home" ? "flex min-h-0 flex-1 flex-col" : "hidden"
                }
              >
                <HomeFeedScreen
                  coins={guest ? 0 : coins}
                  diamonds={guest ? 0 : data.diamonds}
                  avatar={guest ? null : data.avatar}
                  active={tab === "home"}
                  guest={guest}
                  resumeLikeId={resumeLikeId}
                  onResumeLikeConsumed={() => setResumeLikeId(null)}
                  onBuyPack={(pack) => {
                    if (pack.creator) noteCreatorEngagement(pack.creator);
                    requireAuth({ type: "buy", pack, kind: "buy-pack" });
                  }}
                  onLikeAttempt={(id) => {
                    if (authed) return true;
                    requireAuth({ type: "like", feedItemId: id });
                    return false;
                  }}
                  onProfile={() => requestTab("profile")}
                  onOpenStore={openStore}
                  onNotify={() => {
                    if (guest) {
                      requireAuth({ type: "tab", tab: "profile" });
                      return;
                    }
                    setNavNotice("You're all caught up");
                    window.setTimeout(() => setNavNotice(""), 1600);
                  }}
                />
              </div>
              {tab === "feed" && (
                <HomeScreen
                  showTutorial={false}
                  onTutorialDone={() => undefined}
                  onSkipTutorial={() => undefined}
                  onRestart={restart}
                  onStartPlaying={(pack) => {
                    if (pack.creator) noteCreatorEngagement(pack.creator);
                    requireAuth({ type: "buy", pack, kind: "buy-pack" });
                  }}
                  onOpenCreator={(id) => {
                    noteCreatorEngagement(id);
                    setCreatorId(id);
                  }}
                />
              )}
              {tab === "hub" && !guest && (
                <HubScreen onOpenStore={openStore} />
              )}
              {tab === "bag" && !guest && (
                <CollectionScreen
                  onOpenCreator={setCreatorId}
                  onOpenPack={(pack) =>
                    requireAuth({
                      type: "buy",
                      pack,
                      kind: "open-pack",
                    })
                  }
                  onExplorePacks={() => setTab("home")}
                />
              )}
              {tab === "profile" && !guest && (
                <UserDashboardScreen
                  name={data.displayName || data.username}
                  avatar={data.avatar}
                  coins={coins}
                  diamonds={data.diamonds}
                  onSettings={() => setOverlay("settings")}
                />
              )}
              <FooterNav
                active={tab}
                visible
                onChange={requestTab}
                bagBadge={
                  !guest &&
                  (data.welcomeClaimed || purchasedPacks > 0) &&
                  tab !== "bag"
                    ? { type: "dot" as const }
                    : undefined
                }
              />
            </>
          )}

          <AuthenticationSheet
            open={authOpen}
            trigger={triggerFromAction(pending)}
            onDismiss={dismissAuth}
            onSuccess={completeAuth}
          />

          <VerifyEmailModal
            open={verifyOpen}
            email={data.email || getAuthEmail()}
            onLater={() => {
              setVerifyOpen(false);
              setVerifyPending(null);
            }}
            onEmailChanged={(next) => {
              setData((d) => ({ ...d, email: next }));
            }}
            onVerified={() => {
              markEmailVerified();
              setEmailVerified(true);
              setVerifyOpen(false);
              const action = verifyPending;
              setVerifyPending(null);
              // Verification never decides recommendation — evaluate after verify
              window.setTimeout(() => applyRecommendationDecision(action), 0);
            }}
          />

          {navNotice ? (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[13px] backdrop-blur-md">
              {navNotice}
            </div>
          ) : null}

          {authed &&
          !purchaseFlow &&
          !overlay &&
          !creatorId &&
          tab === "profile" ? (
            <button
              type="button"
              className="auth7-logout-fab"
              onClick={logout}
            >
              Log out
            </button>
          ) : null}
        </div>
      )}
    </SiteShell>
  );
}
