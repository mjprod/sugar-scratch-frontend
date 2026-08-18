import { motion } from "framer-motion";
import { Gift, Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  REDEEM_ERROR_COPY,
  redeemCode,
  type RedeemReward,
} from "@/services/redeem";
import { WELCOME_REWARDS } from "@/types/app";

function referralSuccessCopy(reward: RedeemReward) {
  if (reward.type === "diamonds") {
    return `Referral applied — +${reward.amount} Diamonds added.`;
  }
  return `Referral applied — ${reward.sceneName} pack added.`;
}

export function WelcomeRewardScreen({
  claiming,
  onClaim,
  onDismiss,
  onReferralReward,
}: {
  claiming: boolean;
  onClaim: () => void;
  onDismiss: () => void;
  onReferralReward: (reward: RedeemReward) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  async function applyReferral(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = code.trim();
    if (busy || claiming || !trimmed) {
      if (!trimmed) setMsg({ type: "err", text: "Enter a referral code." });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await redeemCode(trimmed);
      if (res.success && res.reward) {
        onReferralReward(res.reward);
        setMsg({ type: "ok", text: referralSuccessCopy(res.reward) });
        return;
      }
      setMsg({
        type: "err",
        text: REDEEM_ERROR_COPY[res.errorType ?? "network_error"],
      });
    } catch {
      setMsg({ type: "err", text: REDEEM_ERROR_COPY.network_error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth7-onboard-panel auth7-welcome">
      <button
        type="button"
        className="auth7-welcome-close"
        aria-label="Close"
        disabled={claiming}
        onClick={onDismiss}
      >
        <X className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>

      <motion.div
        className="auth7-welcome-hero"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="auth7-welcome-mark" aria-hidden="true">
          <Gift className="size-8" strokeWidth={1.6} />
        </span>
        <h1 className="auth7-onboard-title">Welcome reward</h1>
        <p className="auth7-onboard-copy">
          Claim your starter gifts. A creator referral code is optional.
        </p>
      </motion.div>

      <ul className="auth7-welcome-list">
        {WELCOME_REWARDS.map((reward, i) => (
          <motion.li
            key={reward.id}
            className="auth7-welcome-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
          >
            <span>{reward.label}</span>
            <span>{reward.detail}</span>
          </motion.li>
        ))}
      </ul>

      <form className="auth7-welcome-referral" onSubmit={(e) => void applyReferral(e)}>
        <p className="auth7-welcome-referral-title">Have a creator referral code?</p>
        <p className="auth7-welcome-referral-copy">
          Optional — you can redeem later in Store.
        </p>
        <div className="auth7-welcome-referral-row">
          <input
            className="auth7-input"
            value={code}
            placeholder="Referral code"
            autoComplete="off"
            disabled={busy || claiming}
            onChange={(e) => {
              setCode(e.target.value);
              setMsg(null);
            }}
          />
          <button
            type="submit"
            className="auth7-welcome-apply"
            disabled={busy || claiming}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              "Apply"
            )}
          </button>
        </div>
        {msg ? (
          <p
            className={
              msg.type === "ok" ? "auth7-welcome-ok" : "auth7-error"
            }
            role={msg.type === "err" ? "alert" : undefined}
          >
            {msg.text}
          </p>
        ) : null}
      </form>

      <div className="auth7-onboard-spacer" />

      <div className="auth2-primary-cta">
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          fillParent
          type="button"
          label={claiming ? "Claiming…" : "Claim"}
          costAmount={null}
          fontSize={15}
          strokeWidth={1}
          disabled={claiming}
          onClick={onClaim}
        />
      </div>
      <button
        type="button"
        className="auth7-welcome-skip"
        disabled={claiming}
        onClick={onDismiss}
      >
        Skip
      </button>
    </div>
  );
}
