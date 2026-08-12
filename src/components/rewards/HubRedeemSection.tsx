import { Check, Gem, Gift, Info, Loader2, Ticket } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  REDEEM_ERROR_COPY,
  redeemCode,
  type RedeemErrorType,
  type RedeemReward,
} from "@/services/redeem";

type HubRedeemState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "success"; reward: RedeemReward }
  | { status: "error"; errorType: RedeemErrorType };

/** Secondary Hub utility — discoverable, low visual priority. */
export function HubRedeemSection({
  onDiamondReward,
  onPackReward,
  onOpenPack,
  hideHeading = false,
}: {
  onDiamondReward: (amount: number) => void;
  onPackReward: (reward: Extract<RedeemReward, { type: "free_pack" }>) => {
    instanceId?: string;
  };
  onOpenPack: (input: {
    packId: string;
    packName: string;
    creator: string;
    instanceId?: string;
  }) => void;
  /** When true, omit section eyebrow (e.g. opened from ACTIVE tile). */
  hideHeading?: boolean;
}) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<HubRedeemState>({ status: "idle" });
  const [packInstanceId, setPackInstanceId] = useState<string | undefined>();

  const busy = state.status === "validating";
  const error =
    state.status === "error" ? REDEEM_ERROR_COPY[state.errorType] : null;

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = code.trim();
    if (busy || !trimmed) return;

    setState({ status: "validating" });
    setPackInstanceId(undefined);

    try {
      const res = await redeemCode(trimmed);
      if (res.success && res.reward) {
        setState({ status: "success", reward: res.reward });
        if (res.reward.type === "diamonds") {
          onDiamondReward(res.reward.amount);
        } else {
          const result = onPackReward(res.reward);
          setPackInstanceId(result.instanceId);
        }
        return;
      }
      setState({
        status: "error",
        errorType: res.errorType ?? "network_error",
      });
    } catch {
      setState({ status: "error", errorType: "network_error" });
    }
  }

  return (
    <section
      className={["hub-redeem", hideHeading ? "hub-redeem--panel" : ""].filter(Boolean).join(" ")}
      aria-labelledby={hideHeading ? undefined : "hub-redeem-heading"}
      aria-label={hideHeading ? "Redeem a code" : undefined}
    >
      {hideHeading ? null : (
        <h2 id="hub-redeem-heading" className="hub-section-label hub-section-label--redeem">
          <Ticket className="size-3.5" aria-hidden="true" />
          Redeem a code
        </h2>
      )}

      <div className="hub-redeem-card">
        <div className="hub-redeem-intro">
          <span className="hub-redeem-motif" aria-hidden="true">
            <Ticket className="size-5" />
          </span>
          <p className="hub-redeem-lead">
            Have a code? Redeem it for your reward.
          </p>
        </div>

        <form
          className="hub-redeem-form"
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <label className="sr-only" htmlFor="hub-redeem-input">
            Redeem code
          </label>
          <input
            id="hub-redeem-input"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            disabled={busy}
            placeholder="Enter your code"
            onChange={(e) => {
              setCode(e.target.value);
              if (state.status === "error" || state.status === "success") {
                setState({ status: "idle" });
              }
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? "hub-redeem-error" : "hub-redeem-hint"
            }
            className="hub-redeem-input"
          />
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="hub-redeem-submit"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading…
              </>
            ) : (
              "Redeem"
            )}
          </button>
        </form>

        {error ? (
          <p id="hub-redeem-error" role="alert" className="hub-redeem-error">
            {error}
          </p>
        ) : (
          <p id="hub-redeem-hint" className="hub-redeem-hint">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            Codes are not case-sensitive.
          </p>
        )}

        {state.status === "success" ? (
          <HubRedeemSuccess
            reward={state.reward}
            onOpenNow={
              state.reward.type === "free_pack"
                ? () => {
                    const pack = state.reward as Extract<
                      RedeemReward,
                      { type: "free_pack" }
                    >;
                    onOpenPack({
                      packId: pack.packId,
                      packName: pack.sceneName,
                      creator: pack.creatorHandle,
                      instanceId: packInstanceId,
                    });
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function HubRedeemSuccess({
  reward,
  onOpenNow,
}: {
  reward: RedeemReward;
  onOpenNow?: () => void;
}) {
  if (reward.type === "diamonds") {
    return (
      <div className="hub-redeem-success" aria-live="polite">
        <p className="hub-redeem-success-kicker">
          <Check className="size-3.5" aria-hidden="true" />
          Code redeemed
        </p>
        <p className="hub-redeem-success-amount">
          <Gem className="size-5 text-sky-300" aria-hidden="true" />
          +{reward.amount}
        </p>
        <p className="hub-redeem-success-body">Added to your balance.</p>
      </div>
    );
  }

  return (
    <div className="hub-redeem-success" aria-live="polite">
      <p className="hub-redeem-success-kicker">
        <Check className="size-3.5" aria-hidden="true" />
        Pack unlocked
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-white/70">
          <Gift className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">
            {reward.sceneName}
          </p>
          <p className="mt-0.5 text-[12px] text-white/50">
            From @{reward.creatorHandle} · Unopened Packs
          </p>
        </div>
      </div>
      {onOpenNow ? (
        <button
          type="button"
          onClick={onOpenNow}
          className="mt-4 h-11 w-full rounded-full bg-white text-[13px] font-semibold text-[#0a0a0f] transition active:scale-[0.98] sm:w-auto sm:px-5"
        >
          Open Now
        </button>
      ) : null}
    </div>
  );
}
