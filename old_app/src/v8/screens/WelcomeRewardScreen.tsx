import { motion } from "framer-motion";
import { useState } from "react";
import { LightScreen } from "../components/PhoneShell";
import { Button, HomeIndicator } from "../components/ui";
import { WELCOME_REWARDS } from "../flow/types";

export function WelcomeRewardScreen({
  onClaim,
  onClose,
}: {
  onClaim: (referral: { code: string; applied: boolean }) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);

  function applyReferral() {
    const trimmed = code.trim();
    if (!trimmed) {
      setMsg({ type: "err", text: "Enter a referral code." });
      return;
    }
    if (trimmed.toLowerCase() === "invalid") {
      setMsg({ type: "err", text: "Invalid code, please try again." });
      setApplied(false);
      return;
    }
    setApplied(true);
    setMsg({
      type: "ok",
      text: "Referral applied — bonus coins will appear in your wallet.",
    });
  }

  async function claim() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    onClaim({ code: code.trim(), applied });
  }

  return (
    <LightScreen>
      <div className="relative flex flex-1 flex-col px-6 pt-12">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-12 right-6 grid size-10 place-items-center rounded-full border border-line bg-surface-raised text-ink-secondary"
        >
          ✕
        </button>

        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-6 text-center"
        >
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-rose to-berry text-[32px] shadow-glow">
            🎁
          </div>
          <h1 className="mt-5 font-display text-[34px] font-semibold tracking-[-0.02em]">
            Welcome reward
          </h1>
          <p className="mt-2 text-[15px] text-ink-secondary">
            Claim your starter gifts — referral code is optional.
          </p>
        </motion.div>

        <ul className="mt-8 flex flex-col gap-2.5">
          {WELCOME_REWARDS.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
              className="flex items-center justify-between rounded-2xl border border-line bg-surface-muted px-4 py-3.5"
            >
              <span className="text-[15px] font-medium">{r.label}</span>
              <span className="text-[13px] font-semibold text-brand">{r.detail}</span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-6 rounded-[20px] border border-line bg-surface-raised p-4">
          <p className="text-[14px] font-semibold">Have a creator referral code?</p>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            Optional — you can redeem later in Settings or Store.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setMsg(null);
                setApplied(false);
              }}
              placeholder="Referral code"
              className="h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px]"
            />
            <Button type="button" variant="secondary" className="h-11 rounded-xl px-4" onClick={applyReferral}>
              Apply
            </Button>
          </div>
          {msg ? (
            <p
              className={[
                "mt-2 text-[12px]",
                msg.type === "ok" ? "text-success" : "text-danger",
              ].join(" ")}
            >
              {msg.text}
            </p>
          ) : null}
        </div>

        <div className="flex-1" />
        <Button full variant="primary" loading={loading} onClick={claim}>
          Claim
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-center text-[13px] font-medium text-ink-tertiary"
        >
          Skip for now
        </button>
        <HomeIndicator />
      </div>
    </LightScreen>
  );
}
