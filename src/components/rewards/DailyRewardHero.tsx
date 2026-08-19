import { Check, Clock, Gift, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import {
  claimDailyReward,
  formatCountdown,
  getDailyRewardResetAt,
  isDailyRewardClaimedToday,
  resetDailyRewardClaim,
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

  function handleResetForTesting() {
    resetDailyRewardClaim();
    setClaimed(false);
    setRemaining(getDailyRewardResetAt() - Date.now());
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
        <div className="hub-daily-hero-head">
          <h3 id="hub-daily-title" className="hub-daily-hero-title">
            Daily Reward
          </h3>
          {!claimed ? (
            <span className="hub-daily-ready-chip">
              <span className="hub-daily-ready-dot" aria-hidden="true" />
              Ready
            </span>
          ) : null}
        </div>

        {claimed ? (
          <button
            type="button"
            className="hub-daily-hero-copy hub-daily-hero-copy--claimed"
            onClick={handleResetForTesting}
          >
            <Check className="size-4 shrink-0" aria-hidden="true" />
            Claimed for today
          </button>
        ) : (
          <p className="hub-daily-hero-copy">Your reward is ready!</p>
        )}
      </div>

      <div className="hub-daily-stage" aria-hidden="true">
        <span className="hub-daily-stage-bloom" />
        <span className="hub-daily-stage-particle is-a">
          <Sparkles className="size-3" />
        </span>
        <span className="hub-daily-stage-particle is-b">
          <DiamondLottie size={12} aria-hidden />
        </span>
        <span className="hub-daily-stage-particle is-c">
          <Sparkles className="size-2.5" />
        </span>
        <span className="hub-daily-stage-particle is-d">
          <DiamondLottie size={10} aria-hidden />
        </span>
        <div className="hub-daily-stage-object">
          <Gift className="hub-daily-stage-gift" strokeWidth={1.35} />
        </div>
        <span className="hub-daily-stage-platform" />
      </div>

      <div className="hub-daily-hero-actions">
        {claimed ? (
          <>
            <p className="hub-daily-hero-sub">Come back tomorrow.</p>
            <p className="hub-daily-hero-reset">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              Next reward in{" "}
              <span className="tabular-nums">{countdown}</span>
            </p>
          </>
        ) : (
          <>
            <div className="hub-daily-hero-cta">
              <CtaButton
                {...ctaButtonPropsFromTemplate("pillGoldCTA")}
                fillParent
                label={claiming ? "Claiming…" : "Claim Reward"}
                costAmount={null}
                fontSize={14}
                disabled={claiming}
                aria-busy={claiming}
                onClick={handleClaim}
              />
            </div>
            <p className="hub-daily-hero-reset">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              Resets in <span className="tabular-nums">{countdown}</span>
            </p>
          </>
        )}
      </div>
    </article>
  );
}
