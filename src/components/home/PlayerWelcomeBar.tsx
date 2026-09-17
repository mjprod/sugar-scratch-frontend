import { Check, Clock } from "lucide-react";
import { useEffect, useId, useState } from "react";
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
  const isNewUser = isNewUserForHomepageHero();
  const firstName = firstNameFromProfile(profile);
  const [claimed, setClaimed] = useState(() => isDailyRewardClaimedToday());
  const [remaining, setRemaining] = useState(
    () => getDailyRewardResetAt() - Date.now(),
  );
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setRemaining(getDailyRewardResetAt(new Date(now)) - now);
      setClaimed(isDailyRewardClaimedToday(new Date(now)));
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
    if (claimed || claiming) return;
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

  return (
    <section
      className={[
        "player-welcome-bar",
        claimed ? "is-claimed" : "is-ready",
      ].join(" ")}
      aria-labelledby={titleId}
      id="daily-reward"
    >
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
        {claimed ? (
          <div className="player-welcome-claimed">
            <p className="player-welcome-claimed-label">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              Reward claimed ✨
            </p>
            <p className="player-welcome-next">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              Next reward ·{" "}
              <span className="tabular-nums">{countdown}</span>
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="player-welcome-claim"
            disabled={claiming}
            aria-busy={claiming}
            onClick={handleClaim}
          >
            {claiming ? "Claiming…" : claimLabel}
          </button>
        )}

        {burst ? (
          <span className="player-welcome-burst" aria-hidden="true">
            +{DAILY_REWARD_DIAMONDS}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="player-welcome-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
