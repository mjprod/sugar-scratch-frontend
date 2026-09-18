import {
  useEffect,
  useId,
  useRef,
  useState,
  type AnimationEvent,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isNewUserForHomepageHero } from "@/services/collectionState";
import {
  DAILY_REWARD_DIAMONDS,
  claimDailyReward,
  formatCountdown,
  getDailyRewardResetAt,
  isDailyRewardClaimedToday,
} from "@/services/dailyReward";

function track(event: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("sugar:analytics", { detail: { event, payload } }),
  );
}

function firstNameFromProfile(profile: {
  displayName: string;
  username: string;
  email: string;
}): string {
  const raw =
    profile.displayName.trim() ||
    profile.username.trim() ||
    profile.email.split("@")[0]?.trim() ||
    "";
  if (!raw) return "there";
  const first = raw.split(/\s+/)[0] ?? raw;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

type ClaimUiPhase = "ready" | "exiting" | "claimed";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Homepage player welcome / daily reward status bar (replaces Daily Reward card).
 */
export function PlayerWelcomeBar({
  onClaimed,
  onClaimAttempt,
  claimLabel = "FREE",
  readySubtitle,
}: {
  onClaimed: (diamonds: number) => void;
  onClaimAttempt?: () => boolean;
  /** CTA label when the daily gift is available. */
  claimLabel?: string;
  /** Override subtitle while the daily gift is still claimable. */
  readySubtitle?: string;
}) {
  const { profile } = useAuth();
  const titleId = useId();
  const barRef = useRef<HTMLElement>(null);
  const isNewUser = isNewUserForHomepageHero();
  const firstName = firstNameFromProfile(profile);
  const [claimed, setClaimed] = useState(() => isDailyRewardClaimedToday());
  const [uiPhase, setUiPhase] = useState<ClaimUiPhase>(() =>
    isDailyRewardClaimedToday() ? "claimed" : "ready",
  );
  const [remaining, setRemaining] = useState(
    () => getDailyRewardResetAt() - Date.now(),
  );
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [burst, setBurst] = useState(false);
  const [exitHeightPx, setExitHeightPx] = useState<number | null>(null);
  /** True only after a live claim transition (not cold load already-claimed). */
  const [playClaimedEnter, setPlayClaimedEnter] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setRemaining(getDailyRewardResetAt(new Date(now)) - now);
      const stillClaimed = isDailyRewardClaimedToday(new Date(now));
      setClaimed(stillClaimed);
      // Midnight reset: return to ready card without replay of exit anim.
      if (!stillClaimed) {
        setUiPhase((phase) => (phase === "ready" ? phase : "ready"));
        setExitHeightPx(null);
        setPlayClaimedEnter(false);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    track("homepage_player_welcome_viewed", {
      user_state: isNewUser ? "new" : "returning",
      reward_state: isDailyRewardClaimedToday() ? "claimed" : "available",
    });
  }, [isNewUser]);

  function handleClaim() {
    if (claimed || claiming || uiPhase !== "ready") return;
    if (onClaimAttempt && !onClaimAttempt()) return;
    setError("");
    setClaiming(true);
    track("homepage_daily_reward_claim_clicked", {
      reward_type: "diamond",
      reward_amount: DAILY_REWARD_DIAMONDS,
    });
    const result = claimDailyReward();
    setClaiming(false);
    if (!result.ok) {
      setError("Couldn't claim your reward. Try again.");
      return;
    }
    setClaimed(true);
    setBurst(true);
    window.setTimeout(() => setBurst(false), 900);
    onClaimed(result.diamonds);
    track("homepage_daily_reward_claimed", {
      reward_type: "diamond",
      reward_amount: result.diamonds,
    });

    if (prefersReducedMotion()) {
      setPlayClaimedEnter(true);
      setUiPhase("claimed");
      setExitHeightPx(null);
      return;
    }

    const height = barRef.current?.getBoundingClientRect().height ?? null;
    setExitHeightPx(height && height > 0 ? height : null);
    setUiPhase("exiting");
  }

  function onExitAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== "player-welcome-card-exit") return;
    setPlayClaimedEnter(true);
    setUiPhase("claimed");
    setExitHeightPx(null);
  }

  const countdown = formatCountdown(remaining);
  const greetingTitle = isNewUser
    ? `Welcome to Sugar, ${firstName}!`
    : `Welcome back, ${firstName}!`;
  const greetingSubtitle =
    readySubtitle ??
    (isNewUser
      ? "Your collection starts here ✨"
      : "Keep collecting, you're on a roll ✨");

  const showCard = uiPhase === "ready" || uiPhase === "exiting";
  const showClaimed = uiPhase === "claimed";

  return (
    <section
      ref={barRef}
      className={[
        "player-welcome-bar",
        uiPhase === "ready" ? "is-ready" : "",
        uiPhase === "exiting" ? "is-claim-exiting" : "",
        uiPhase === "claimed" ? "is-claimed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      id="daily-reward"
      style={
        uiPhase === "exiting" && exitHeightPx
          ? { height: `${exitHeightPx}px` }
          : undefined
      }
      onAnimationEnd={uiPhase === "exiting" ? onExitAnimationEnd : undefined}
    >
      {showClaimed ? (
        <div
          className={[
            "player-welcome-claimed",
            playClaimedEnter ? "is-enter" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <p id={titleId} className="player-welcome-claimed-label">
            Reward Claimed
          </p>
          <p className="player-welcome-next">
            Next Reward{" "}
            <span className="tabular-nums">{countdown}</span>
          </p>
        </div>
      ) : null}

      {showCard ? (
        <>
          <div className="player-welcome-greeting">
            <span className="player-welcome-gift" aria-hidden="true">
              <span className="player-welcome-gift__box" />
              <span className="player-welcome-gift__lid" />
              <span className="player-welcome-gift__bow" />
            </span>
            <div className="player-welcome-copy">
              <h3 id={titleId} className="player-welcome-title">
                {greetingTitle}
              </h3>
              <p className="player-welcome-subtitle">{greetingSubtitle}</p>
            </div>
          </div>

          <div className="player-welcome-reward">
            <button
              type="button"
              className="player-welcome-claim"
              disabled={claiming || uiPhase === "exiting"}
              aria-busy={claiming || uiPhase === "exiting"}
              onClick={handleClaim}
            >
              {claiming ? "Claiming…" : claimLabel}
            </button>

            {burst ? (
              <span className="player-welcome-burst" aria-hidden="true">
                +{DAILY_REWARD_DIAMONDS}
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? (
        <p className="player-welcome-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
