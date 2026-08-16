import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  clearEmailVerified,
  createSession,
  destroySession,
  fetchAuthSession,
  getAuthEmail,
  isAuthenticated,
  isEmailVerified,
  logoutRemote,
  markEmailVerified,
  markEmailVerifiedRemote,
  needsEmailVerification,
  type AuthenticationSheetMode,
  type AuthSuccessResult,
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
import { clearOpening, type PurchaseFlowPack } from "@/services/purchase";
import { clearV8Session, markEntered, markOnboardingDone } from "@/lib/session";
import type { AppTab, OnboardingData } from "@/types/app";
import { Paths, pathForTab, PUBLIC_TABS, tabFromPathname } from "@/routes/Paths";
import {
  resolveSecondaryBack,
  SECONDARY_SURFACES,
} from "@/lib/navigation";

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

type AuthContextValue = {
  authed: boolean;
  guest: boolean;
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
  openCreator: (id: string) => void;
  openPurchase: (pack: PurchaseFlowPack, kind?: "buy-pack" | "open-pack") => void;
  openSettings: () => void;
  openPasswordReset: () => void;
  closeSecondary: (surface: SecondarySurfaceId) => void;
  inventoryRevision: number;
  bumpInventoryRevision: () => void;
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
  verifyEmail: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => isAuthenticated());
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

  const bumpInventoryRevision = useCallback(() => {
    setInventoryRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAuthSession().then((session) => {
      if (cancelled) return;
      if (!session.authenticated || !session.user) {
        destroySession();
        clearEmailVerified();
        setAuthed(false);
        setEmailVerified(false);
        return;
      }
      createSession(session.user.email, session.user.provider);
      if (session.user.emailVerified) markEmailVerified();
      else clearEmailVerified();
      setAuthed(true);
      setEmailVerified(session.user.emailVerified);
      setProfile((prev) => ({
        ...prev,
        email: session.user.email,
        username: session.user.username ?? prev.username,
        displayName: session.user.displayName ?? prev.displayName,
        avatar: session.user.avatarUrl,
        genderInterest: session.user.genderInterest,
        referralCode: session.user.referralCode || prev.referralCode,
        welcomeClaimed: session.user.welcomeClaimed,
        homeTutorialDone: session.user.homeTutorialDone,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const captureSecondaryReturn = useCallback(() => {
    setSecondaryReturnTab(tabFromPathname(window.location.pathname));
  }, []);

  const guest = !authed;

  const resumePending = useCallback(
    (action: ProtectedAction | null) => {
      if (!action) return;
      if (action.type === "buy" || action.type === "scratch") {
        if (action.pack.creator) setRecommendationSeedCreator(action.pack.creator);
        const isBuyPack =
          action.type === "buy" ? action.kind !== "open-pack" : true;
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
      if (action.type === "tab") {
        navigate(pathForTab(action.tab));
      }
    },
    [captureSecondaryReturn, navigate],
  );

  const applyRecommendationDecision = useCallback(
    (pendingAction: ProtectedAction | null) => {
      const decision = evaluateRecommendationEligibility({
        pending: pendingAction,
      });

      if (decision.action === "launch-initialization") {
        if (pendingAction && !isHighIntentForDefer(pendingAction)) {
          setPendingAfterRec(pendingAction);
        }
        navigate(Paths.recommend);
        return;
      }

      resumePending(pendingAction);
    },
    [navigate, resumePending],
  );

  const finishRecommendationAndResume = useCallback(() => {
    const deferred = pendingAfterRec;
    setPendingAfterRec(null);
    navigate(Paths.home);
    if (deferred) {
      window.setTimeout(() => resumePending(deferred), 0);
    }
  }, [navigate, pendingAfterRec, resumePending]);

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

  const openCreator = useCallback(
    (id: string) => {
      noteCreatorEngagement(id);
      navigate(Paths.creator(id));
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
      const next = resolveSecondaryBack(secondaryReturnTab, surface);
      setSecondaryReturnTab(null);
      navigate(pathForTab(next));
    },
    [navigate, secondaryReturnTab],
  );

  const completeAuth = useCallback(
    (result: AuthSuccessResult) => {
      const wasUnresolved = !isRecommendationInitialized();
      const action = pending;
      createSession(result.email, result.provider);
      applyUserFromEmail(result.email);
      markEntered();
      markOnboardingDone();
      setAuthOpen(false);
      setAuthSheetMode("login");
      setAuthSheetEmail("");
      setAuthed(true);
      setEmailVerified(isEmailVerified());

      if (result.provider === "email" && wasUnresolved) {
        clearEmailVerified();
        setEmailVerified(false);
      }

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

  const logout = useCallback(() => {
    void logoutRemote();
    destroySession();
    setAuthed(false);
    setPending(null);
    setAuthOpen(false);
    setVerifyOpen(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    navigate(Paths.home);
    setNavNotice("Signed out — browsing as guest");
    window.setTimeout(() => setNavNotice(""), 1800);
  }, [navigate]);

  const restart = useCallback(() => {
    void logoutRemote();
    clearV8Session();
    clearRecommendationState();
    clearEmailVerified();
    destroySession();
    clearHomeFeedCache();
    setProfile(initialProfile);
    setAuthed(false);
    setEmailVerified(false);
    setVerifyOpen(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    setPurchasedPacks(0);
    setPending(null);
    setAuthOpen(false);
    navigate(Paths.loading);
  }, [navigate]);

  const consumeResumeLike = useCallback(() => setResumeLikeId(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authed,
      guest,
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
      openCreator,
      openPurchase,
      openSettings,
      openPasswordReset,
      closeSecondary,
      inventoryRevision,
      bumpInventoryRevision,
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
      logout,
      navNotice,
      notePackPurchaseSeed,
      onEmailChanged,
      onVerified,
      onVerifyLater,
      bumpInventoryRevision,
      closeSecondary,
      inventoryRevision,
      openCreator,
      openInbox,
      openPasswordReset,
      openPurchase,
      openSettings,
      openStore,
      pending,
      profile,
      purchasedPacks,
      requireAuth,
      requestTab,
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
