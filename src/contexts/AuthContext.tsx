import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { memoryNavigate } from "@/lib/memory/memoryNavigate";
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
import { resetPageReady } from "@/shared/ui/pageWarmth";
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
} from "@/services/gameSessionStore";
import { unlockCountdownSound } from "@/features/game/modules/countdownSound";
import { resolveSecondaryBack } from "@/lib/navigation";
import { navigateBackOr } from "@/hooks/useGoBack";
import {
  AuthActionsContext,
  AuthContext,
  AuthSessionContext,
  type AuthActionsContextValue,
  type AuthContextValue,
  type AuthSessionContextValue,
  type SecondarySurfaceId,
} from "@/contexts/useAuth";

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
  return false;
}

function isHighIntentForDefer(action: ProtectedAction) {
  return (
    action.type === "buy" ||
    action.type === "store" ||
    (action.type === "tab" && action.tab === "feed")
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
  /** True only when verify opened right after Create Account (back → recreate). */
  const [verifyFromRegister, setVerifyFromRegister] = useState(false);
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
    setSecondaryReturnTab(tabFromPathname(window.location.pathname, authed));
  }, [authed]);

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
          memoryNavigate(
            motionPlayHref(
              packSession,
              firstMissingMotionCardId(packSession),
            ),
          );
          return;
        }
        memoryNavigate(Paths.purchase(action.pack.packId), {
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
          memoryNavigate(photoPlayHref(started));
          return;
        }
        if (!packId) {
          const session = loadGameSession();
          if (
            session &&
            (session.phase === "photo_reveal" || session.phase === "photo")
          ) {
            const started = beginPhotoPhase() ?? session;
            memoryNavigate(photoPlayHref(started));
            return;
          }
        }
        memoryNavigate(Paths.collection);
        return;
      }
      if (action.type === "buy") {
        if (action.pack.creator) setRecommendationSeedCreator(action.pack.creator);
        const isBuyPack =
          action.kind !== "open-pack" && action.pack.entry !== "cart-tear";
        if (isBuyPack) clearOpening();
        memoryNavigate(
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
        memoryNavigate(Paths.discover);
        return;
      }
      if (action.type === "follow") {
        // Apply follow after login. Stay on creator profiles; otherwise Discover.
        followCreator({
          id: action.creatorId,
          displayName: action.displayName?.trim() || action.creatorId,
          username: "",
          avatarUrl: action.avatarUrl?.trim() || "/img/placeholder.webp",
          followedAt: Date.now(),
          hasUnseenActivity: false,
        });
        if (!window.location.pathname.startsWith("/creator/")) {
          memoryNavigate(Paths.discover);
        }
        return;
      }
      if (action.type === "store") {
        captureSecondaryReturn();
        memoryNavigate(Paths.store);
        return;
      }
      if (action.type === "inbox") {
        captureSecondaryReturn();
        memoryNavigate(Paths.inbox);
        return;
      }
      if (action.type === "unopened-packs") {
        memoryNavigate(Paths.collectionPacks);
        return;
      }
      if (action.type === "cart") {
        captureSecondaryReturn();
        memoryNavigate(Paths.packPocket);
        return;
      }
      if (action.type === "add-to-cart") {
        addPackToCart(action.pack);
        return;
      }
      if (action.type === "collection") {
        noteCreatorEngagement(action.creatorId);
        memoryNavigate(Paths.creator(action.creatorId));
        return;
      }
      if (action.type === "resume") {
        const target = action.path.trim();
        if (target.startsWith("/")) {
          memoryNavigate(target);
        }
        return;
      }
      if (action.type === "tab") {
        memoryNavigate(pathForTab(action.tab, true));
      }
    },
    [captureSecondaryReturn],
  );

  const enterAfterOnboarding = useCallback(
    (opts?: {
      deferred?: ProtectedAction | null;
      scrollToDailyReward?: boolean;
    }) => {
      // First-run / post-recommend lands on logged-in Home — not Profile.
      // Soft-gate from /profile queues { type: "resume", path } (or the older
      // tab form); both would otherwise send new users back to Profile.
      const deferred = opts?.deferred ?? null;
      const resume =
        deferred && !isProfileOnboardingResume(deferred) ? deferred : null;

      if (resume) {
        memoryNavigate(Paths.discover);
        window.setTimeout(() => resumePending(resume), 0);
        return;
      }
      memoryNavigate(Paths.discover);
    },
    [resumePending],
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
        memoryNavigate(Paths.recommend);
        return;
      }

      // Sign-in / Profile soft-gate must not dump returning users on Profile.
      if (pendingAction && isProfileOnboardingResume(pendingAction)) {
        memoryNavigate(Paths.discover);
        return;
      }

      if (shouldResumeAfterAuth(pendingAction)) {
        resumePending(pendingAction);
        return;
      }

      enterAfterOnboarding({ scrollToDailyReward: true });
    },
    [enterAfterOnboarding, resumePending],
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
          setVerifyFromRegister(false);
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
        memoryNavigate(pathForTab(next, authed));
        return;
      }
      requireAuth({ type: "tab", tab: next });
    },
    [authed, requireAuth],
  );

  const openStore = useCallback(() => {
    captureSecondaryReturn();
    memoryNavigate(Paths.store);
  }, [captureSecondaryReturn]);

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
      memoryNavigate(`${Paths.creator(id)}${query}`);
    },
    [],
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
    memoryNavigate(Paths.settings);
  }, [captureSecondaryReturn, guest, requireAuth]);

  const openPasswordReset = useCallback(() => {
    setPending(null);
    setAuthSheetMode("forgot-password");
    setAuthSheetEmail(getAuthEmail());
    setAuthOpen(true);
  }, []);

  const openCreateAccount = useCallback(() => {
    if (authed) return;
    setPending(null);
    setAuthSheetMode("create-account");
    setAuthSheetEmail("");
    setAuthOpen(true);
  }, [authed]);

  const closeSecondary = useCallback(
    (surface: SecondarySurfaceId) => {
      setSecondaryReturnTab(null);
      // Prefer the real previous step (Discover → Creator → back, etc.).
      navigateBackOr(
        navigate,
        pathForTab(resolveSecondaryBack(secondaryReturnTab, surface), authed),
      );
    },
    [authed, navigate, secondaryReturnTab],
  );

  const completeAuth = useCallback(
    (result: AuthSuccessResult) => {
      const action = pending;
      const openedFromRegister = result.source === "register";
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
            const needsVerify =
              needsEmailVerification() &&
              (openedFromRegister ||
                (action != null && actionNeedsVerifiedEmail(action)));
            if (needsVerify) {
              setVerifyFromRegister(openedFromRegister);
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
    // Confirm already set email_verified_at on the server; mirror locally.
    markEmailVerified();
    setEmailVerified(true);
    setVerifyOpen(false);
    setVerifyFromRegister(false);
    const action = verifyPending;
    setVerifyPending(null);
    window.setTimeout(() => applyRecommendationDecision(action), 0);
  }, [applyRecommendationDecision, verifyPending]);

  const onVerifyLater = useCallback(() => {
    setVerifyOpen(false);
    setVerifyFromRegister(false);
    const action = verifyPending;
    setVerifyPending(null);
    // Registration always opens verify; Later still resumes non-purchase journeys.
    if (!action || !actionNeedsVerifiedEmail(action)) {
      window.setTimeout(() => applyRecommendationDecision(action), 0);
    }
  }, [applyRecommendationDecision, verifyPending]);

  /**
   * Back on verify sheet:
   * - After Create Account → drop unverified session, reopen create sheet.
   * - Already signed in (login / gated action) → close sheet only; stay authed.
   */
  const onVerifyBack = useCallback(() => {
    if (!verifyFromRegister) {
      onVerifyLater();
      return;
    }

    const action = verifyPending;
    const email = profile.email || getAuthEmail();
    setVerifyOpen(false);
    setVerifyFromRegister(false);
    setVerifyPending(null);

    // Drop the unverified session so create-account can be submitted again.
    sessionSyncEpochRef.current += 1;
    void logoutRemote();
    destroySession();
    clearEmailVerified();
    setAuthed(false);
    setEmailVerified(false);

    setPending(action);
    setAuthSheetEmail(email);
    setAuthSheetMode("create-account");
    setAuthOpen(true);
  }, [onVerifyLater, profile.email, verifyFromRegister, verifyPending]);

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
    setVerifyFromRegister(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    memoryNavigate(Paths.discover);
  }, []);

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
    setVerifyFromRegister(false);
    setVerifyPending(null);
    setPendingAfterRec(null);
    setPurchasedPacks(0);
    setPending(null);
    setAuthOpen(false);
    memoryNavigate(Paths.home);
  }, []);

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
      openCreateAccount,
      closeSecondary,
      bumpInventoryRevision,
      invalidatePackSync,
      completeAuth,
      dismissAuth,
      onVerified,
      onVerifyLater,
      onVerifyBack,
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
      onVerifyBack,
      openCart,
      openCreateAccount,
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
      verifyFromRegister,
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
      openCreateAccount,
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
      onVerifyBack,
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
      onVerifyBack,
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
      openCreateAccount,
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
      verifyFromRegister,
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
