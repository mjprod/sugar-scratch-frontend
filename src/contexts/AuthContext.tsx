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
import { followCreator } from "@/services/following";
import { clearOpening, type PurchaseFlowPack } from "@/services/purchase";
import { clearPackInventory, syncMyPacks } from "@/services/packInventory";
import {
  adoptAccountLocalState,
  clearAccountLocalState,
  clearAccountStateOwner,
  clearUngatedAccountArtifacts,
} from "@/services/accountLocalState";
import { isDemoMode } from "@/lib/demo";
import { clearV8Session, markEntered, markOnboardingDone } from "@/lib/session";
import { fulfillPendingWelcomeGift, hasPendingWelcomeGift } from "@/services/welcome";
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

/** Profile soft-gates must not resume after first-run onboarding (Discover instead). */
function isProfileOnboardingResume(action: ProtectedAction) {
  if (action.type === "tab") return action.tab === "profile";
  if (action.type !== "resume") return false;
  const pathname = action.path.trim().split(/[?#]/)[0] ?? "";
  return (
    pathname === Paths.profile ||
    pathname.startsWith(`${Paths.profile}/`) ||
    pathname === Paths.settings ||
    pathname.startsWith(`${Paths.settings}/`)
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
    action.type === "follow" ||
    action.type === "inbox" ||
    action.type === "unopened-packs" ||
    action.type === "cart" ||
    action.type === "add-to-cart" ||
    action.type === "collection" ||
    action.type === "tab" ||
    action.type === "resume" ||
    action.type === "claim"
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
  opts?: { setAuthed?: boolean },
) {
  if (user.id) {
    adoptAccountLocalState(user.id, {
      preserveWelcomePending: hasPendingWelcomeGift(),
    });
  }
  createSession(user.email, user.provider, user.id);
  if (user.emailVerified) markEmailVerified();
  else clearEmailVerified();
  if (opts?.setAuthed !== false) {
    setters.setAuthed(true);
  }
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
  /** False until the initial `/api/auth/session` probe finishes. */
  authReady: boolean;
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
  /** Drop in-flight login pack syncs before writing claim/purchase inventory. */
  invalidatePackSync: () => void;
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

/** Session flags only — feed cards subscribe here instead of the full bag. */
type AuthSessionContextValue = {
  authReady: boolean;
  authed: boolean;
  guest: boolean;
  hasLoggedInBefore: boolean;
  emailVerified: boolean;
};

/** Stable-ish action callbacks — separate so profile/inventory churn won't re-render cards. */
type AuthActionsContextValue = {
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
  bumpInventoryRevision: () => void;
  invalidatePackSync: () => void;
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
  setPurchasedPacks: Dispatch<SetStateAction<number>>;
  consumeResumeLike: () => void;
  applyRecommendationDecision: (action: ProtectedAction | null) => void;
  invalidateRemoteSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
const AuthActionsContext = createContext<AuthActionsContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
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

  // Bumped on login/logout so stale in-flight auth/inventory sync cannot cross sessions.
  const sessionSyncEpochRef = useRef(0);

  const invalidatePackSync = useCallback(() => {
    sessionSyncEpochRef.current += 1;
  }, []);

  useEffect(() => {
    if (!authed || isDemoMode()) return;
    const epoch = sessionSyncEpochRef.current;
    let cancelled = false;
    void syncMyPacks({
      beforeWrite: () =>
        !cancelled && epoch === sessionSyncEpochRef.current,
    }).then((ok) => {
      if (cancelled) return;
      if (epoch !== sessionSyncEpochRef.current) return;
      if (ok) bumpInventoryRevision();
    });
    return () => {
      cancelled = true;
    };
  }, [authed, bumpInventoryRevision]);

  useEffect(() => {
    let cancelled = false;
    const epoch = sessionSyncEpochRef.current;
    void fetchAuthSession()
      .then((session) => {
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
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
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
        navigate(
          action.pack.entry === "cart-tear"
            ? Paths.purchaseTearOpen
            : Paths.purchase(action.pack.packId),
          {
            state: {
              pack: isBuyPack
                ? { ...action.pack, entry: "purchase" as const }
                : action.pack,
            },
          },
        );
        return;
      }
      if (action.type === "like") {
        setResumeLikeId(action.feedItemId);
        navigate(Paths.discover);
        return;
      }
      if (action.type === "follow") {
        // Apply follow after login. Stay on creator profiles; otherwise Discover.
        followCreator({
          id: action.creatorId,
          displayName: action.displayName?.trim() || action.creatorId,
          username: "",
          avatarUrl: action.avatarUrl?.trim() || "/img/placeholder.png",
          followedAt: Date.now(),
          hasUnseenActivity: false,
        });
        if (!window.location.pathname.startsWith("/creator/")) {
          navigate(Paths.discover);
        }
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
        return;
      }
      if (action.type === "collection") {
        noteCreatorEngagement(action.creatorId);
        navigate(Paths.creator(action.creatorId));
        return;
      }
      if (action.type === "resume") {
        const target = action.path.trim();
        if (target.startsWith("/")) {
          navigate(target);
        }
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
      // First-run / post-recommend always lands on Discover — not Profile.
      // Soft-gate from /profile now queues { type: "resume", path } (or the
      // older tab form); both would otherwise send new users back to Profile.
      const deferred = opts?.deferred ?? null;
      const resume =
        deferred && !isProfileOnboardingResume(deferred) ? deferred : null;

      if (resume) {
        navigate(Paths.discover);
        window.setTimeout(() => resumePending(resume), 0);
        return;
      }
      navigate(Paths.discover);
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

      const accountAlreadyClaimed = Boolean(result.user?.welcomeClaimed);

      // Establish the local session first, but delay setAuthed(true) until any
      // guest-deferred welcome claim finishes. That way the login pack sync
      // (triggered by authed) cannot replace inventory with a pre-claim snapshot.
      if (result.user) {
        applyRemoteUser(
          result.user,
          { setAuthed, setEmailVerified, setProfile },
          { setAuthed: false },
        );
      } else {
        createSession(result.email, result.provider);
        applyUserFromEmail(result.email);
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

      void (async () => {
        try {
          const welcome = await fulfillPendingWelcomeGift(accountAlreadyClaimed);
          if (welcome.granted) {
            setProfile((d) => ({
              ...d,
              welcomeClaimed: welcome.welcomeClaimed ?? true,
            }));
            setPurchasedPacks((n) => n + 1);
            bumpInventoryRevision();
          }
        } finally {
          // Start pack sync only after claim attempt so server wins with the gift.
          setAuthed(true);
          // Resume only after authed flips — SoftGate must see authed=true.
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
      })();
    },
    [applyRecommendationDecision, bumpInventoryRevision, pending],
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
    clearPackInventory();
    clearUngatedAccountArtifacts();
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
    clearPackInventory();
    clearUngatedAccountArtifacts();
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
    clearAccountLocalState();
    clearAccountStateOwner();
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

  const sessionValue = useMemo<AuthSessionContextValue>(
    () => ({
      authReady,
      authed,
      guest,
      hasLoggedInBefore: returningUser,
      emailVerified,
    }),
    [authReady, authed, emailVerified, guest, returningUser],
  );

  const actionsValue = useMemo<AuthActionsContextValue>(
    () => ({
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
      bumpInventoryRevision,
      invalidatePackSync,
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
      setPurchasedPacks,
      consumeResumeLike,
      applyRecommendationDecision,
      invalidateRemoteSession,
    }),
    [
      addToCart,
      applyRecommendationDecision,
      bumpInventoryRevision,
      closeSecondary,
      completeAuth,
      consumeResumeLike,
      dismissAuth,
      finishRecommendationAndResume,
      invalidatePackSync,
      invalidateRemoteSession,
      logout,
      notePackPurchaseSeed,
      onEmailChanged,
      onVerified,
      onVerifyLater,
      openCart,
      openCreator,
      openInbox,
      openPasswordReset,
      openPurchase,
      openSettings,
      openStore,
      openUnopenedPacks,
      requireAuth,
      requestTab,
      restart,
      setNavNotice,
      setPendingAfterRecFromSwipe,
      setPurchasedPacks,
    ],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady,
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
      invalidatePackSync,
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
      authReady,
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
      invalidatePackSync,
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

  return (
    <AuthSessionContext.Provider value={sessionValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      </AuthActionsContext.Provider>
    </AuthSessionContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Session flags only — prefer this in feed cards / hot lists. */
export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error("useAuthSession must be used within AuthProvider");
  return ctx;
}

/** Auth actions only — avoids re-renders from profile / inventory / sheet state. */
export function useAuthActions() {
  const ctx = useContext(AuthActionsContext);
  if (!ctx) throw new Error("useAuthActions must be used within AuthProvider");
  return ctx;
}
