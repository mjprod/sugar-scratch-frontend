import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  clearEmailVerified,
  clearHasLoggedIn,
  createSession,
  destroySession,
  fetchAuthSession,
  getAuthEmail,
  hasLoggedInBefore,
  isEmailVerified,
  logoutRemote,
  markEmailVerified,
  markEmailVerifiedRemote,
  needsEmailVerification,
  type AuthenticationSheetMode,
  type AuthSuccessResult,
  type AuthUser,
  type ProtectedAction,
} from "@/services/auth";
import {
  clearRecommendationState,
  evaluateRecommendationEligibility,
  isRecommendationInitialized,
  markRecommendationBehaviorSeeded,
  noteCreatorEngagement,
  setRecommendationSeedCreator,
} from "@/services/recommendation";
import { clearHomeFeedCache } from "@/services/creatorFeed";
import { addPackToCart, type CartAddInput } from "@/services/cart";
import { clearOpening, type PurchaseFlowPack } from "@/services/purchase";
import { clearV8Session, markEntered, markOnboardingDone } from "@/lib/session";
import { resetPageReady } from "@/shared/ui/PageTransition";
import type { AppTab, OnboardingData } from "@/types/app";
import { Paths, pathForTab, PUBLIC_TABS, tabFromPathname } from "@/routes/Paths";
import {
  activateGameSessionForPack,
  beginPhotoPhase,
  firstMissingMotionCardId,
  loadGameSession,
  loadGameSessionForPack,
  motionPlayHref,
  photoPlayHref,
} from "@/features/game/modules/gameSession";
import { unlockCountdownSound } from "@/features/game/modules/InitialCountdown";
import {
  resolveSecondaryBack,
  SECONDARY_SURFACES,
} from "@/lib/navigation";
import { navigateBackOr } from "@/hooks/useGoBack";

type SecondarySurfaceId = keyof typeof SECONDARY_SURFACES;

const initialProfile: Omit<OnboardingData, "coins" | "diamonds"> = {
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
};

function actionNeedsVerifiedEmail(action: ProtectedAction) {
  if (action.type === "buy") return true;
  if (action.type === "store") return true;
  if (action.type === "tab" && action.tab === "hub") return true;
  return false;
}

function isHighIntentForDefer(action: ProtectedAction) {
  return (
    action.type === "buy" ||
    action.type === "store" ||
    (action.type === "tab" && action.tab === "hub")
  );
}

/** Mid-flow actions that should resume after login instead of going Home. */
function shouldResumeAfterAuth(action: ProtectedAction | null) {
  if (!action) return false;
  return (
    action.type === "buy" ||
    action.type === "scratch" ||
    action.type === "photo-scratch" ||
    action.type === "store" ||
    action.type === "like" ||
    action.type === "inbox" ||
    action.type === "unopened-packs" ||
    action.type === "cart" ||
    action.type === "add-to-cart" ||
    action.type === "collection"
  );
}

function applyRemoteUser(
  user: AuthUser,
  setters: {
    setAuthed: Dispatch<SetStateAction<boolean>>;
    setEmailVerified: Dispatch<SetStateAction<boolean>>;
    setProfile: Dispatch<
      SetStateAction<Omit<OnboardingData, "coins" | "diamonds">>
    >;
  },
) {
  createSession(user.email, user.provider, user.id);
  if (user.emailVerified) markEmailVerified();
  else clearEmailVerified();
  setters.setAuthed(true);
  setters.setEmailVerified(user.emailVerified);
  setters.setProfile((prev) => ({
    ...prev,
    email: user.email,
    username: user.username ?? prev.username,
    displayName: user.displayName ?? prev.displayName,
    avatar: user.avatarUrl,
    genderInterest: user.genderInterest,
    referralCode: user.referralCode || prev.referralCode,
    welcomeClaimed: user.welcomeClaimed,
    homeTutorialDone: user.homeTutorialDone,
  }));
}

type AuthContextValue = {
  authed: boolean;
  guest: boolean;
  hasLoggedInBefore: boolean;
  guestAuthLabel: "Sign in";
  profile: Omit<OnboardingData, "coins" | "diamonds">;
  setProfile: Dispatch<
    SetStateAction<Omit<OnboardingData, "coins" | "diamonds">>
  >;
  authOpen: boolean;
  authSheetMode: AuthenticationSheetMode;
  authSheetEmail: string;
  pending: ProtectedAction | null;
  emailVerified: boolean;
  verifyOpen: boolean;
  resumeLikeId: string | null;
  navNotice: string;
  purchasedPacks: number;
  setPurchasedPacks: Dispatch<SetStateAction<number>>;
  requireAuth: (action: ProtectedAction) => boolean;
  requestTab: (tab: AppTab) => void;
  openStore: () => void;
  openInbox: () => void;
  openUnopenedPacks: () => void;
  openCart: () => void;
  addToCart: (pack: CartAddInput) => void;
  openCreator: (id: string, themeId?: string) => void;
  openPurchase: (pack: PurchaseFlowPack, kind?: "buy-pack" | "open-pack") => void;
  openSettings: () => void;
  openPasswordReset: () => void;
  closeSecondary: (surface: SecondarySurfaceId) => void;
  inventoryRevision: number;
  bumpInventoryRevision: () => void;
  inboxUnread: number;
  setInboxUnread: Dispatch<SetStateAction<number>>;
  completeAuth: (result: AuthSuccessResult) => void;
  dismissAuth: () => void;
  onVerified: () => void;
  onVerifyLater: () => void;
  onEmailChanged: (email: string) => void;
  notePackPurchaseSeed: (creatorName?: string) => void;
  finishRecommendationAndResume: () => void;
  setPendingAfterRecFromSwipe: (
    liked: string[],
    passed: string[],
  ) => void;
  logout: () => void;
  restart: () => void;
  setNavNotice: (msg: string) => void;
  consumeResumeLike: () => void;
  applyRecommendationDecision: (action: ProtectedAction | null) => void;
  invalidateRemoteSession: () => void;
  verifyEmail: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [returningUser, setReturningUser] = useState(() => hasLoggedInBefore());
  const [profile, setProfile] = useState(initialProfile);
  const [authOpen, setAuthOpen] = useState(false);
  const [authSheetMode, setAuthSheetMode] =
    useState<AuthenticationSheetMode>("login");
  const [authSheetEmail, setAuthSheetEmail] = useState("");
  const [pending, setPending] = useState<ProtectedAction | null>(null);
  const [resumeLikeId, setResumeLikeId] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(() => isEmailVerified());
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPending, setVerifyPending] = useState<ProtectedAction | null>(
    null,
  );
  const [pendingAfterRec, setPendingAfterRec] =
    useState<ProtectedAction | null>(null);
  const [navNotice, setNavNotice] = useState("");
  const [purchasedPacks, setPurchasedPacks] = useState(0);
  const [secondaryReturnTab, setSecondaryReturnTab] = useState<AppTab | null>(
    null,
  );
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const [inboxUnread, setInboxUnread] = useState(0);

  const bumpInventoryRevision = useCallback(() => {
    setInventoryRevision((n) => n + 1);
  }, []);

  // Bumped on login/logout so a stale in-flight session probe cannot wipe a fresh session.
  const sessionSyncEpochRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const epoch = sessionSyncEpochRef.current;
    void fetchAuthSession().then((session) => {
      if (cancelled) return;
      // Ignore results from a probe that started before a local auth transition.
      if (epoch !== sessionSyncEpochRef.current) return;

      if (session.state === "unreachable") {
        // Cookie may still be valid. Do not resume gated actions (authed stays false).
        return;
      }

      if (session.authenticated && session.user) {
        applyRemoteUser(session.user, {
          setAuthed,
          setEmailVerified,
          setProfile,
        });
        return;
      }

      destroySession();
      clearEmailVerified();
      setAuthed(false);
      setEmailVerified(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const captureSecondaryReturn = useCallback(() => {
    setSecondaryReturnTab(tabFromPathname(window.location.pathname));
  }, []);

  const guest = !authed;
  const guestAuthLabel = "Sign in" as const;

  useEffect(() => {
    if (guest) {
      document.body.dataset.guest = "";
    } else {
      delete document.body.dataset.guest;
    }
    return () => {
      delete document.body.dataset.guest;
    };
  }, [guest]);

  const resumePending = useCallback(
    (action: ProtectedAction | null) => {
      if (!action || action.type === "session-expired") return;
      if (action.type === "scratch") {
        // Collection / auth resume is a user gesture — unlock 3-2-1 audio so
        // ScratchPrototype can skip Tap-to-play and arm the countdown.
        unlockCountdownSound();
        const readyId = action.pack.instanceId ?? action.pack.packId;
        // Pack-keyed only — resumeHref must not land in another pack's hand.
        const packSession =
          activateGameSessionForPack(readyId) ??
          loadGameSessionForPack(readyId);
        if (
          packSession?.phase === "motion" &&
          (!packSession.packScratch?.readyPackId ||
            packSession.packScratch.readyPackId === readyId)
        ) {
          activateGameSessionForPack(readyId);
          navigate(
            motionPlayHref(
              packSession,
              firstMissingMotionCardId(packSession),
            ),
          );
          return;
        }
        navigate(Paths.purchase(action.pack.packId), {
          state: { pack: { ...action.pack, entry: "scratch" as const } },
        });
        return;
      }
      if (action.type === "photo-scratch") {
        unlockCountdownSound();
        const packId = action.packId?.trim();
        const packSession =
          packId && packId !== "session"
            ? (activateGameSessionForPack(packId) ??
              loadGameSessionForPack(packId))
            : null;
        if (
          packSession &&
          (packSession.phase === "photo_reveal" ||
            packSession.phase === "photo") &&
          (!packSession.packScratch?.readyPackId ||
            !packId ||
            packSession.packScratch.readyPackId === packId)
        ) {
          const started = beginPhotoPhase() ?? packSession;
          navigate(photoPlayHref(started));
          return;
        }
        if (!packId) {
          const session = loadGameSession();
          if (
            session &&
            (session.phase === "photo_reveal" || session.phase === "photo")
          ) {
            const started = beginPhotoPhase() ?? session;
            navigate(photoPlayHref(started));
            return;
          }
        }
        navigate(Paths.collection);
        return;
      }
      if (action.type === "buy") {
        if (action.pack.creator) setRecommendationSeedCreator(action.pack.creator);
        const isBuyPack =
          action.kind !== "open-pack" && action.pack.entry !== "cart-tear";
        if (isBuyPack) clearOpening();
        navigate(Paths.purchase(action.pack.packId), {
          state: {
            pack: isBuyPack
              ? { ...action.pack, entry: "purchase" as const }
              : action.pack,
          },
        });
        return;
      }
      if (action.type === "like") {
        setResumeLikeId(action.feedItemId);
        navigate(Paths.discover);
        return;
      }
      if (action.type === "store") {
        captureSecondaryReturn();
        navigate(Paths.store);
        return;
      }
      if (action.type === "inbox") {
        captureSecondaryReturn();
        navigate(Paths.inbox);
        return;
      }
      if (action.type === "unopened-packs") {
        navigate(Paths.collectionPacks);
        return;
      }
      if (action.type === "cart") {
        captureSecondaryReturn();
        navigate(Paths.packPocket);
        return;
      }
      if (action.type === "add-to-cart") {
        addPackToCart(action.pack);
        captureSecondaryReturn();
        navigate(Paths.packPocket);
        return;
      }
      if (action.type === "collection") {
        noteCreatorEngagement(action.creatorId);
        navigate(Paths.creator(action.creatorId));
        return;
      }
      if (action.type === "tab") {
        navigate(pathForTab(action.tab));
      }
    },
    [captureSecondaryReturn, navigate],
  );

  const enterAfterOnboarding = useCallback(
    (opts?: {
      deferred?: ProtectedAction | null;
      scrollToDailyReward?: boolean;
    }) => {
      const deferred = opts?.deferred ?? null;
      if (deferred) {
        navigate(Paths.home);
        window.setTimeout(() => resumePending(deferred), 0);
        return;
      }
      navigate(Paths.home, {
        state: opts?.scrollToDailyReward
          ? { scrollToDailyReward: true }
          : undefined,
      });
    },
    [navigate, resumePending],
  );

  const applyRecommendationDecision = useCallback(
    (pendingAction: ProtectedAction | null) => {
      const decision = evaluateRecommendationEligibility({
        pending: pendingAction,
        authenticated: true,
      });

      if (decision.action === "launch-initialization") {
        if (pendingAction && !isHighIntentForDefer(pendingAction)) {
          setPendingAfterRec(pendingAction);
        }
        navigate(Paths.recommend);
        return;
      }

      if (shouldResumeAfterAuth(pendingAction)) {
        resumePending(pendingAction);
        return;
      }

      enterAfterOnboarding({ scrollToDailyReward: true });
    },
    [enterAfterOnboarding, navigate, resumePending],
  );

  const finishRecommendationAndResume = useCallback(() => {
    const deferred = pendingAfterRec;
    setPendingAfterRec(null);
    enterAfterOnboarding({
      deferred,
      scrollToDailyReward: !deferred,
    });
  }, [enterAfterOnboarding, pendingAfterRec]);

  function applyUserFromEmail(email: string) {
    const local = email.split("@")[0] || "collector";
    const username =
      local.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) ||
      "collector";
    setProfile((d) => ({
      ...d,
      email,
      username: d.username || username,
      displayName: d.displayName || d.username || username,
      avatar: d.avatar || "✨",
      homeTutorialDone: true,
    }));
  }

  const requireAuth = useCallback(
    (action: ProtectedAction) => {
      if (authed) {
        if (actionNeedsVerifiedEmail(action) && needsEmailVerification()) {
          setVerifyPending(action);
          setVerifyOpen(true);
          return false;
        }
        resumePending(action);
        return true;
      }
      setPending(action);
      setAuthSheetMode("login");
      setAuthSheetEmail("");
      setAuthOpen(true);
      return false;
    },
    [authed, resumePending],
  );

  const requestTab = useCallback(
    (next: AppTab) => {
      if (PUBLIC_TABS.includes(next) || authed) {
        navigate(pathForTab(next));
        return;
      }
      requireAuth({ type: "tab", tab: next });
    },
    [authed, navigate, requireAuth],
  );

  const openStore = useCallback(() => {
    captureSecondaryReturn();
    navigate(Paths.store);
  }, [captureSecondaryReturn, navigate]);

  const openInbox = useCallback(() => {
    if (!requireAuth({ type: "inbox" })) return;
  }, [requireAuth]);

  const openUnopenedPacks = useCallback(() => {
    if (!requireAuth({ type: "unopened-packs" })) return;
  }, [requireAuth]);

  const openCart = useCallback(() => {
    if (!requireAuth({ type: "cart" })) return;
  }, [requireAuth]);

  const addToCart = useCallback(
    (pack: CartAddInput) => {
      if (pack.creator) noteCreatorEngagement(pack.creator);
      requireAuth({ type: "add-to-cart", pack });
    },
    [requireAuth],
  );

  const openCreator = useCallback(
    (id: string, themeId?: string) => {
      noteCreatorEngagement(id);
      const query = themeId?.trim()
        ? `?theme=${encodeURIComponent(themeId.trim())}`
        : "";
      navigate(`${Paths.creator(id)}${query}`);
    },
    [navigate],
  );

  const openPurchase = useCallback(
    (pack: PurchaseFlowPack, kind: "buy-pack" | "open-pack" = "buy-pack") => {
      if (pack.creator) noteCreatorEngagement(pack.creator);
      requireAuth({ type: "buy", pack, kind });
    },
    [requireAuth],
  );

  const openSettings = useCallback(() => {
    if (guest) {
      requireAuth({ type: "tab", tab: "profile" });
      return;
    }
    captureSecondaryReturn();
    navigate(Paths.settings);
  }, [captureSecondaryReturn, guest, navigate, requireAuth]);

  const openPasswordReset = useCallback(() => {
    setPending(null);
    setAuthSheetMode("forgot-password");
    setAuthSheetEmail(getAuthEmail());
    setAuthOpen(true);
  }, []);

  const closeSecondary = useCallback(
    (surface: SecondarySurfaceId) => {
      setSecondaryReturnTab(null);
      // Prefer the real previous step (Discover → Creator → back, etc.).
      navigateBackOr(navigate, pathForTab(resolveSecondaryBack(secondaryReturnTab, surface)));
    },
    [navigate, secondaryReturnTab],
  );

  const completeAuth = useCallback(
    (result: AuthSuccessResult) => {
      const action = pending;
      sessionSyncEpochRef.current += 1;
      setReturningUser(true);

      if (result.user) {
        applyRemoteUser(result.user, {
          setAuthed,
          setEmailVerified,
          setProfile,
        });
      } else {
        createSession(result.email, result.provider);
        applyUserFromEmail(result.email);
        setAuthed(true);
        setEmailVerified(isEmailVerified());
        if (result.provider === "email" && !isRecommendationInitialized()) {
          clearEmailVerified();
          setEmailVerified(false);
        }
      }

      markEntered();
      markOnboardingDone();
      setAuthOpen(false);
      setAuthSheetMode("login");
      setAuthSheetEmail("");
      setPending(null);
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
    },
    [applyRecommendationDecision, pending],
  );

  const dismissAuth = useCallback(() => {
    setAuthOpen(false);
    setPending(null);
    setAuthSheetMode("login");
    setAuthSheetEmail("");
  }, []);

  const onVerified = useCallback(() => {
    markEmailVerified();
    void markEmailVerifiedRemote();
    setEmailVerified(true);
    setVerifyOpen(false);
    const action = verifyPending;
    setVerifyPending(null);
    window.setTimeout(() => applyRecommendationDecision(action), 0);
  }, [applyRecommendationDecision, verifyPending]);

  const onVerifyLater = useCallback(() => {
    setVerifyOpen(false);
    setVerifyPending(null);
  }, []);

  const onEmailChanged = useCallback((email: string) => {
    setProfile((d) => ({ ...d, email }));
  }, []);

  const notePackPurchaseSeed = useCallback((creatorName?: string) => {
    markRecommendationBehaviorSeeded(creatorName);
  }, []);

  const setPendingAfterRecFromSwipe = useCallback(
    (liked: string[], passed: string[]) => {
      setProfile((d) => ({
        ...d,
        likedCreators: liked,
        passedCreators: passed,
      }));
    },
    [],
  );

  const invalidateRemoteSession = useCallback(() => {
    sessionSyncEpochRef.current += 1;
    destroySession();
    clearEmailVerified();
    setAuthed(false);
    setEmailVerified(false);
    setInboxUnread(0);
    setPending({ type: "session-expired" });
    setAuthSheetMode("login");
    setAuthSheetEmail("");
    setAuthOpen(true);
  }, []);

  const logout = useCallback(() => {
    sessionSyncEpochRef.current += 1;
    void logoutRemote();
    destroySession();
    setAuthed(false);
    setPending(null);
    setAuthOpen(false);
    setVerifyOpen(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    navigate(Paths.discover);
  }, [navigate]);

  const restart = useCallback(() => {
    sessionSyncEpochRef.current += 1;
    void logoutRemote();
    clearV8Session();
    resetPageReady();
    clearRecommendationState();
    clearEmailVerified();
    clearHasLoggedIn();
    destroySession();
    clearHomeFeedCache();
    setProfile(initialProfile);
    setAuthed(false);
    setReturningUser(false);
    setEmailVerified(false);
    setVerifyOpen(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    setPurchasedPacks(0);
    setPending(null);
    setAuthOpen(false);
    navigate(Paths.home);
  }, [navigate]);

  const consumeResumeLike = useCallback(() => setResumeLikeId(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authed,
      guest,
      hasLoggedInBefore: returningUser,
      guestAuthLabel,
      profile,
      setProfile,
      authOpen,
      authSheetMode,
      authSheetEmail,
      pending,
      emailVerified,
      verifyOpen,
      resumeLikeId,
      navNotice,
      purchasedPacks,
      setPurchasedPacks,
      requireAuth,
      requestTab,
      openStore,
      openInbox,
      openUnopenedPacks,
      openCart,
      addToCart,
      openCreator,
      openPurchase,
      openSettings,
      openPasswordReset,
      closeSecondary,
      inventoryRevision,
      bumpInventoryRevision,
      inboxUnread,
      setInboxUnread,
      completeAuth,
      dismissAuth,
      onVerified,
      onVerifyLater,
      onEmailChanged,
      notePackPurchaseSeed,
      finishRecommendationAndResume,
      setPendingAfterRecFromSwipe,
      logout,
      restart,
      setNavNotice,
      consumeResumeLike,
      applyRecommendationDecision,
      invalidateRemoteSession,
      verifyEmail: profile.email || getAuthEmail(),
    }),
    [
      applyRecommendationDecision,
      authOpen,
      authSheetEmail,
      authSheetMode,
      authed,
      completeAuth,
      consumeResumeLike,
      dismissAuth,
      emailVerified,
      finishRecommendationAndResume,
      guest,
      guestAuthLabel,
      invalidateRemoteSession,
      logout,
      navNotice,
      notePackPurchaseSeed,
      onEmailChanged,
      onVerified,
      onVerifyLater,
      bumpInventoryRevision,
      closeSecondary,
      inboxUnread,
      inventoryRevision,
      openCreator,
      openInbox,
      openUnopenedPacks,
      openCart,
      addToCart,
      openPasswordReset,
      openPurchase,
      openSettings,
      openStore,
      pending,
      profile,
      purchasedPacks,
      requireAuth,
      requestTab,
      returningUser,
      restart,
      resumeLikeId,
      setPendingAfterRecFromSwipe,
      verifyOpen,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
