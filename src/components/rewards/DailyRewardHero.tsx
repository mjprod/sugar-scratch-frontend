import { ArrowRight, Check, Clock, Gem, Gift, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  claimDailyReward,
  formatCountdown,
  getDailyRewardResetAt,
  isDailyRewardClaimedToday,
} from "@/services/dailyReward";

/**
 * Hub primary reward stage — available / claimed with live reset clock.
 */
export function DailyRewardHero({
  onClaimed,
}: {
  onClaimed: (diamonds: number) => void;
}) {
  const [claimed, setClaimed] = useState(() => isDailyRewardClaimedToday());
  const [remaining, setRemaining] = useState(
    () => getDailyRewardResetAt() - Date.now(),
  );
  const [claiming, setClaiming] = useState(false);

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

  function handleClaim() {
    if (claimed || claiming) return;
    setClaiming(true);
    const result = claimDailyReward();
    setClaiming(false);
    if (result.ok) {
      setClaimed(true);
      onClaimed(result.diamonds);
    }
  }

  const countdown = formatCountdown(remaining);

  return (
    <article
      className={["hub-daily-hero", claimed ? "is-claimed" : "is-ready"].join(
        " ",
      )}
      aria-labelledby="hub-daily-title"
    >
      <div className="hub-daily-hero-body">
        <h3 id="hub-daily-title" className="hub-daily-hero-title">
          Daily Reward
        </h3>

        {claimed ? (
          <>
            <p className="hub-daily-hero-copy hub-daily-hero-copy--claimed">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              Claimed for today
            </p>
            <p className="hub-daily-hero-sub">Come back tomorrow.</p>
            <p className="hub-daily-hero-reset">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              Next reward in{" "}
              <span className="tabular-nums">{countdown}</span>
            </p>
          </>
        ) : (
          <>
            <p className="hub-daily-hero-copy">Your reward is ready!</p>
            <button
              type="button"
              className="hub-daily-hero-cta"
              onClick={handleClaim}
              disabled={claiming}
              aria-busy={claiming}
            >
              {claiming ? "Claiming…" : "Claim Reward"}
              {!claiming ? (
                <ArrowRight className="size-4" aria-hidden="true" />
              ) : null}
            </button>
            <p className="hub-daily-hero-reset">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              Resets in <span className="tabular-nums">{countdown}</span>
            </p>
          </>
        )}
      </div>

      <div className="hub-daily-stage" aria-hidden="true">
        <span className="hub-daily-stage-bloom" />
        <span className="hub-daily-stage-particle is-a">
          <Sparkles className="size-3" />
        </span>
        <span className="hub-daily-stage-particle is-b">
          <Gem className="size-3" />
        </span>
        <span className="hub-daily-stage-particle is-c">
          <Sparkles className="size-2.5" />
        </span>
        <span className="hub-daily-stage-particle is-d">
          <Gem className="size-2.5" />
        </span>
        <div className="hub-daily-stage-object">
          <Gift className="hub-daily-stage-gift" strokeWidth={1.35} />
        </div>
        <span className="hub-daily-stage-platform" />
      </div>
    </article>
  );
}
