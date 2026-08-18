import {
  Check,
  Clock,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  claimRewardedAd,
  clearPurchaseSession,
  createPurchaseSession,
  fetchStoreProducts,
  loadPurchaseSession,
  resumePurchaseSession,
  returnFromGateway,
  type GatewayOutcome,
  type PurchaseSession,
  type StoreBadge,
  type StoreProduct,
} from "@/services/store";
import { AppPageShell } from "@/components/AppPageShell";
import { HubRedeemSection } from "@/components/rewards/HubRedeemSection";
import { useAuth } from "@/contexts/AuthContext";
import type { RedeemReward } from "@/services/redeem";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useMarkPageReady } from "@/shared/ui/PageTransition";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; products: StoreProduct[] }
  | { status: "empty" }
  | { status: "error"; message: string };

/** Paid purchase stages after product selection. */
type Flow =
  | { step: "idle" }
  | { step: "confirm"; product: StoreProduct }
  | { step: "creating"; product: StoreProduct }
  | { step: "gateway"; session: PurchaseSession; product: StoreProduct }
  | { step: "verifying"; session: PurchaseSession; product: StoreProduct }
  | {
      step: "result";
      kind: "success" | "failed" | "cancelled" | "pending";
      title: string;
      body: string;
      product?: StoreProduct;
      session?: PurchaseSession;
    }
  | { step: "ad-processing"; product: StoreProduct };

/**
 * Store — Diamonds, rewarded ads, and third-party purchase flow.
 * Sugar never collects card details; payment runs on a simulated gateway.
 */
export function StoreScreen({
  onBack,
  onPurchaseSuccess,
  onDiamondReward,
  onPackReward,
  onOpenPack,
}: {
  onBack: () => void;
  onPurchaseSuccess: (result: { diamonds: number; coins: number }) => void;
  onDiamondReward?: (amount: number) => void;
  onPackReward?: (reward: Extract<RedeemReward, { type: "free_pack" }>) => {
    instanceId?: string;
  };
  onOpenPack?: (input: {
    packId: string;
    packName: string;
    creator: string;
    instanceId?: string;
  }) => void;
}) {
  const { requireAuth } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  useMarkPageReady(load.status !== "loading");
  const [flow, setFlow] = useState<Flow>({ step: "idle" });
  const [claimedAds, setClaimedAds] = useState<string[]>([]);
  const resumed = useRef(false);
  const locking = useRef(false);

  const reload = useCallback(async () => {
    setLoad({ status: "loading" });
    const result = await fetchStoreProducts();
    if (result.status === "ok") setLoad({ status: "ok", products: result.products });
    else if (result.status === "empty") setLoad({ status: "empty" });
    else setLoad({ status: "error", message: result.message });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Preserve / resume a purchase session if the user left mid-flow.
  // Never jump straight to success on mount — always show gateway or verifying.
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const saved = loadPurchaseSession();
    if (!saved) return;

    void (async () => {
      const product: StoreProduct = {
        id: saved.productId,
        kind: "diamonds",
        title: saved.productTitle,
        priceLabel: saved.priceLabel,
        diamonds: saved.diamonds,
        coins: saved.coins,
        order: 0,
        available: true,
      };
      const result = await resumePurchaseSession(saved);
      if (result.status === "resume-gateway") {
        setFlow({ step: "gateway", session: result.session, product });
        return;
      }
      if (result.status === "resume-verify") {
        setFlow({ step: "verifying", session: result.session, product });
        const verified = await returnFromGateway(result.session, result.outcome);
        applyVerifyResult(verified, product);
        return;
      }
      if (result.status === "pending") {
        setFlow({
          step: "result",
          kind: "pending",
          title: "Payment pending",
          body: "Your payment is still processing. Diamonds will appear once the payment is confirmed.",
          product,
          session: result.session,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot resume
  }, []);

  const busy =
    flow.step === "creating" ||
    flow.step === "verifying" ||
    flow.step === "ad-processing" ||
    flow.step === "gateway";

  function applyVerifyResult(
    result: Awaited<ReturnType<typeof returnFromGateway>>,
    product: StoreProduct,
  ) {
    if (result.status === "closed") {
      // Gateway closed without paying — keep Store context, drop session.
      clearPurchaseSession();
      setFlow({ step: "idle" });
      return;
    }
    if (result.status === "confirmed") {
      if (result.diamonds > 0 || result.coins > 0) {
        onPurchaseSuccess({ diamonds: result.diamonds, coins: result.coins });
      }
      setFlow({
        step: "result",
        kind: "success",
        title: "Purchase successful",
        body: `${product.title} has been added to your balance.`,
        product,
        session: result.session,
      });
      return;
    }
    if (result.status === "pending") {
      setFlow({
        step: "result",
        kind: "pending",
        title: "Payment pending",
        body: "Your payment is still processing. Diamonds will appear once the payment is confirmed.",
        product,
        session: result.session,
      });
      return;
    }
    if (result.status === "cancelled") {
      setFlow({
        step: "result",
        kind: "cancelled",
        title: "Payment cancelled",
        body: "No charge was made. You can try again whenever you’re ready.",
        product,
        session: result.session,
      });
      return;
    }
    setFlow({
      step: "result",
      kind: "failed",
      title: "Purchase failed",
      body: result.message,
      product,
      session: result.session,
    });
  }

  async function startPaidCheckout(product: StoreProduct) {
    if (locking.current || busy) return;
    locking.current = true;
    setFlow({ step: "creating", product });
    try {
      const session = await createPurchaseSession(product);
      setFlow({ step: "gateway", session, product });
    } catch {
      setFlow({
        step: "result",
        kind: "failed",
        title: "Purchase failed",
        body: "Could not start checkout. Please try again.",
        product,
      });
    } finally {
      locking.current = false;
    }
  }

  async function onGatewayReturn(outcome: GatewayOutcome) {
    if (flow.step !== "gateway" || locking.current) return;
    locking.current = true;
    const { session, product } = flow;
    setFlow({ step: "verifying", session, product });
    try {
      const result = await returnFromGateway(session, outcome);
      applyVerifyResult(result, product);
    } finally {
      locking.current = false;
    }
  }

  async function runRewardedAd(product: StoreProduct) {
    if (locking.current || busy) return;
    if (claimedAds.includes(product.id)) return;
    locking.current = true;
    setFlow({ step: "ad-processing", product });
    try {
      const result = await claimRewardedAd(product);
      if (result.status === "success") {
        onPurchaseSuccess({ diamonds: result.diamonds, coins: result.coins });
        setClaimedAds((ids) => (ids.includes(product.id) ? ids : [...ids, product.id]));
        setFlow({
          step: "result",
          kind: "success",
          title: "Reward claimed",
          body: `${result.diamonds} Diamonds added to your balance.`,
          product,
        });
      } else {
        setFlow({
          step: "result",
          kind: "failed",
          title: "Reward unavailable",
          body: result.message,
          product,
        });
      }
    } finally {
      locking.current = false;
    }
  }

  function onSelect(product: StoreProduct) {
    if (busy) return;
    if (product.kind === "rewarded-ad") {
      void runRewardedAd(product);
      return;
    }
    // Guests can browse Store; diamond checkout requires auth.
    if (!requireAuth({ type: "store" })) return;
    setFlow({ step: "confirm", product });
  }

  function backToStore() {
    if (flow.step === "result" && flow.kind !== "pending") {
      clearPurchaseSession();
    }
    setFlow({ step: "idle" });
  }

  const activeProductId =
    flow.step === "creating" ||
    flow.step === "confirm" ||
    flow.step === "ad-processing" ||
    flow.step === "verifying" ||
    flow.step === "gateway"
      ? flow.product.id
      : flow.step === "result"
        ? flow.product?.id
        : undefined;

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Store"
      className="store-page"
    >
      {load.status === "loading" ? <StoreSkeleton /> : null}

      {load.status === "empty" ? (
        <StateBlock
          title="No products are currently available."
          primary={{ label: "Refresh", onClick: () => void reload() }}
        />
      ) : null}

      {load.status === "error" ? (
        <StateBlock
          title={load.message || "Unable to load store items."}
          primary={{ label: "Retry", onClick: () => void reload() }}
          secondary={{ label: "Back", onClick: onBack }}
        />
      ) : null}

      {load.status === "ok" ? (
        <StoreCatalog
          products={load.products}
          claimedAds={claimedAds}
          busy={busy}
          activeProductId={activeProductId}
          flowStep={flow.step}
          onSelect={onSelect}
          onDiamondReward={onDiamondReward}
          onPackReward={onPackReward}
          onOpenPack={onOpenPack}
        />
      ) : null}

      {flow.step === "confirm" ? (
        <ConfirmModal
          product={flow.product}
          onCancel={backToStore}
          onConfirm={() => void startPaidCheckout(flow.product)}
        />
      ) : null}

      {flow.step === "creating" ? (
        <StatusOverlay
          title="Preparing checkout…"
          body="Creating a secure purchase session."
        />
      ) : null}

      {flow.step === "gateway" ? (
        <PaymentGateway
          session={flow.session}
          onReturn={(outcome) => void onGatewayReturn(outcome)}
        />
      ) : null}

      {flow.step === "verifying" ? (
        <StatusOverlay
          title="Verifying payment…"
          body="Confirming with the payment provider. Diamonds are only added after verification."
        />
      ) : null}

      {flow.step === "ad-processing" ? (
        <StatusOverlay title="Watching ad…" body="Please don’t close this page." />
      ) : null}

      {flow.step === "result" ? (
        <ResultModal
          kind={flow.kind}
          title={flow.title}
          body={flow.body}
          onContinue={backToStore}
          onRetry={
            flow.kind === "failed" && flow.product?.kind === "diamonds"
              ? () => setFlow({ step: "confirm", product: flow.product! })
              : flow.kind === "failed" && flow.product?.kind === "rewarded-ad"
                ? () => void runRewardedAd(flow.product!)
                : flow.kind === "pending"
                  ? () => {
                      const saved = loadPurchaseSession();
                      if (!saved || !flow.product) return;
                      setFlow({
                        step: "verifying",
                        session: saved,
                        product: flow.product,
                      });
                      void returnFromGateway(saved, "completed").then((result) =>
                        applyVerifyResult(result, flow.product!),
                      );
                    }
                  : undefined
          }
          retryLabel={flow.kind === "pending" ? "Check status" : "Try again"}
        />
      ) : null}
    </AppPageShell>
  );
}

/* -------------------------------------------------------------------------- */

function StoreCatalog({
  products,
  claimedAds,
  busy,
  activeProductId,
  flowStep,
  onSelect,
  onDiamondReward,
  onPackReward,
  onOpenPack,
}: {
  products: StoreProduct[];
  claimedAds: string[];
  busy: boolean;
  activeProductId?: string;
  flowStep: Flow["step"];
  onSelect: (product: StoreProduct) => void;
  onDiamondReward?: (amount: number) => void;
  onPackReward?: (reward: Extract<RedeemReward, { type: "free_pack" }>) => {
    instanceId?: string;
  };
  onOpenPack?: (input: {
    packId: string;
    packName: string;
    creator: string;
    instanceId?: string;
  }) => void;
}) {
  const ads = products.filter((p) => p.kind === "rewarded-ad");
  const packs = products.filter((p) => p.kind === "diamonds");

  function isProcessing(productId: string) {
    return (
      busy &&
      activeProductId === productId &&
      (flowStep === "creating" ||
        flowStep === "verifying" ||
        flowStep === "ad-processing")
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-7">
      {ads.map((product) => (
        <WatchAdCard
          key={product.id}
          product={product}
          claimed={claimedAds.includes(product.id)}
          processing={isProcessing(product.id)}
          disabled={busy}
          onSelect={() => onSelect(product)}
        />
      ))}

      <section aria-labelledby="buy-diamonds-heading">
        <h2
          id="buy-diamonds-heading"
          className="text-[18px] font-bold tracking-[-0.02em]"
        >
          Buy Diamonds
        </h2>
        <div className="store-packages mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-3.5 xl:grid-cols-5">
          {packs.map((product) => (
            <PackageCard
              key={product.id}
              product={product}
              processing={isProcessing(product.id)}
              disabled={busy}
              onSelect={() => onSelect(product)}
            />
          ))}
        </div>
      </section>

      {onDiamondReward && onPackReward && onOpenPack ? (
        <HubRedeemSection
          onDiamondReward={onDiamondReward}
          onPackReward={onPackReward}
          onOpenPack={onOpenPack}
        />
      ) : null}

      <StoreInfo />
    </div>
  );
}

function WatchAdCard({
  product,
  claimed,
  processing,
  disabled,
  onSelect,
}: {
  product: StoreProduct;
  claimed: boolean;
  processing: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const unavailable = claimed;

  return (
    <button
      type="button"
      disabled={disabled || unavailable}
      aria-busy={processing}
      onClick={onSelect}
      className={[
        "store-watch-ad flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3.5 text-left transition",
        unavailable
          ? "cursor-not-allowed border-white/[0.06] bg-white/[0.03] opacity-60"
          : "border-[oklch(0.711_0.203_357.66)]/25 bg-gradient-to-r from-[oklch(0.711_0.203_357.66)]/12 to-[oklch(0.593_0.265_300.18)]/12 hover:border-[oklch(0.711_0.203_357.66)]/40 active:scale-[0.99]",
        "disabled:cursor-not-allowed",
      ].join(" ")}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[oklch(0.711_0.203_357.66)]/18 text-white">
        {processing ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-5" strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tracking-[-0.01em]">
          {product.title}
        </span>
        <span className="mt-0.5 block text-[13px] text-white/55">
          {product.subtitle ?? `Earn ${product.diamonds} Diamonds`}
        </span>
      </span>
      <span
        className={[
          "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] uppercase",
          unavailable
            ? "border-white/10 text-white/40"
            : "border-emerald-400/35 bg-emerald-400/15 text-emerald-300",
        ].join(" ")}
      >
        {unavailable ? "Claimed" : processing ? "…" : "FREE"}
      </span>
    </button>
  );
}

function PackageCard({
  product,
  processing,
  disabled,
  onSelect,
}: {
  product: StoreProduct;
  processing: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const featured = product.badge === "Best Value";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={processing}
      onClick={onSelect}
      className={[
        "store-package relative flex flex-col items-center rounded-[18px] border px-3 pb-3.5 pt-3 text-center transition",
        featured
          ? "border-[oklch(0.711_0.203_357.66)]/40 bg-[oklch(0.2_0.017_307.52)] shadow-[0_0_24px_oklch(0.711_0.203_357.66_/_0.12)]"
          : "border-white/[0.08] bg-[oklch(0.19_0.01_294.59)] hover:border-white/[0.16]",
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
      ].join(" ")}
    >
      {product.badge ? <BadgeMark badge={product.badge} /> : null}

      <span className="mt-5 grid size-11 place-items-center rounded-full bg-sky-300/10">
        {processing ? (
          <Loader2 className="size-5 animate-spin text-sky-200" aria-hidden="true" />
        ) : (
          <DiamondLottie
            className="store-package-diamond"
            size={24}
            aria-hidden
          />
        )}
      </span>

      <span className="mt-3 text-[26px] font-bold tabular-nums tracking-[-0.03em] leading-none">
        {product.diamonds.toLocaleString()}
      </span>
      <span className="mt-1 text-[12px] font-medium text-white/50">Diamonds</span>

      <span className="mt-3 text-[14px] font-semibold tabular-nums text-white/90">
        {processing ? "Processing…" : product.priceLabel}
      </span>
    </button>
  );
}

function BadgeMark({
  badge,
  muted,
  label,
}: {
  badge: StoreBadge;
  muted?: boolean;
  label?: string;
}) {
  const tone = muted
    ? "border-white/10 bg-black/55 text-white/55"
    : badge === "FREE"
      ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-300"
      : badge === "Best Value"
        ? "border-[oklch(0.711_0.203_357.66)]/45 bg-[oklch(0.711_0.203_357.66)]/15 text-[oklch(0.808_0.127_352.48)]"
        : badge === "Popular"
          ? "border-sky-400/40 bg-sky-400/15 text-sky-300"
          : badge === "Limited Time"
            ? "border-[oklch(0.711_0.166_22.22)]/40 bg-[oklch(0.711_0.166_22.22)]/15 text-[oklch(0.808_0.103_19.57)]"
            : badge === "Bonus"
              ? "border-[oklch(0.811_0.101_293.57)]/40 bg-[oklch(0.606_0.219_292.72)]/20 text-[oklch(0.811_0.101_293.57)]"
              : "border-white/20 bg-white/10 text-white";

  return (
    <span
      className={[
        "absolute top-2.5 left-2.5 z-10 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] uppercase backdrop-blur-md",
        tone,
      ].join(" ")}
    >
      {label ?? badge}
    </span>
  );
}

function StoreInfo() {
  return (
    <p
      className="pb-2 text-center text-[12px] leading-relaxed text-white/40"
      aria-label="Store information"
    >
      Secure payment
      <span className="mx-1.5 text-white/20" aria-hidden="true">
        ·
      </span>
      Instant delivery
      <span className="mx-1.5 text-white/20" aria-hidden="true">
        ·
      </span>
      Trusted checkout
    </p>
  );
}

function StoreSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-7" aria-busy="true" aria-label="Loading store">
      <div className="h-[72px] animate-pulse rounded-[18px] bg-white/[0.06]" />
      <div className="store-packages grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-3.5 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[148px] animate-pulse rounded-[18px] bg-white/[0.06]"
          />
        ))}
      </div>
    </div>
  );
}

function StateBlock({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mt-16 flex flex-col items-center px-4 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/55">
        <RefreshCw className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 max-w-xs text-[15px] text-white/65">{title}</p>
      <button
        type="button"
        onClick={primary.onClick}
        className="mt-6 h-12 min-w-[160px] rounded-full bg-[oklch(0.606_0.219_292.72)] px-6 text-[14px] font-semibold transition active:scale-[0.98]"
      >
        {primary.label}
      </button>
      {secondary ? (
        <button
          type="button"
          onClick={secondary.onClick}
          className="mt-3 h-11 px-5 text-[13px] text-white/55 hover:text-white/80"
        >
          {secondary.label}
        </button>
      ) : null}
    </div>
  );
}

function ConfirmModal({
  product,
  onCancel,
  onConfirm,
}: {
  product: StoreProduct;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onDismiss={onCancel}>
      <h2 className="text-[18px] font-bold">Confirm purchase</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-white/55">
        Buy <span className="text-white">{product.title}</span> for{" "}
        <span className="text-white">{product.priceLabel}</span>?
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        You’ll continue to a secure third-party payment page. Sugar never sees your
        card details.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[oklch(0.147_0.011_285.01)] transition active:scale-[0.98]"
      >
        Continue to payment
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 h-11 w-full text-[13px] text-white/55 hover:text-white/80"
      >
        Cancel
      </button>
    </ModalShell>
  );
}

/**
 * Simulated third-party payment gateway (card entry).
 * Portaled above the app chrome so it feels like leaving Sugar.
 * Card fields are never stored or sent — demo only.
 */
function PaymentGateway({
  session,
  onReturn,
}: {
  session: PurchaseSession;
  onReturn: (outcome: GatewayOutcome) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState("");

  if (typeof document === "undefined") return null;

  function choose(outcome: GatewayOutcome) {
    if (submitting) return;
    setSubmitting(true);
    onReturn(outcome);
  }

  function formatCardNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const digits = cardNumber.replace(/\s/g, "");
    if (cardName.trim().length < 2) {
      setError("Enter the name on the card.");
      return;
    }
    if (digits.length < 16) {
      setError("Enter a valid 16-digit card number.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError("Enter expiry as MM/YY.");
      return;
    }
    if (cvc.replace(/\D/g, "").length < 3) {
      setError("Enter a valid CVC.");
      return;
    }

    setError("");
    // Demo decline path — card ending in 0000 fails after “authorization”.
    if (digits.endsWith("0000")) {
      choose("failed");
      return;
    }
    // Demo pending path — card ending in 0001 stays pending.
    if (digits.endsWith("0001")) {
      choose("pending");
      return;
    }
    choose("completed");
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex flex-col overflow-y-auto bg-[oklch(0.972_0.003_247.86)] text-[oklch(0.208_0.04_265.75)]"
      role="dialog"
      aria-modal="true"
      aria-label="Payment gateway"
    >
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
          <Lock className="size-3.5 text-emerald-600" aria-hidden="true" />
          checkout.pay · Secure
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={() => choose("closed")}
          className="h-10 px-2 text-[13px] text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          Close
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6 pb-10">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          Leaving Sugar · Third-party payment
        </p>
        <h1 className="mt-2 text-[26px] font-bold tracking-[-0.02em] text-slate-900">
          Enter card details
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Card information is processed by the payment provider. Sugar never
          stores or sees these details.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-slate-400">Paying Sugar Scratch</p>
              <p className="mt-1 text-[16px] font-semibold text-slate-900">
                {session.productTitle}
              </p>
            </div>
            <p className="text-[20px] font-bold tabular-nums text-slate-900">
              {session.priceLabel}
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit} noValidate>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Name on card
            </span>
            <input
              type="text"
              name="cc-name"
              autoComplete="cc-name"
              value={cardName}
              disabled={submitting}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Jane Collector"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 outline-none ring-sky-400 placeholder:text-slate-300 focus:ring-2 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Card number
            </span>
            <input
              type="text"
              inputMode="numeric"
              name="cc-number"
              autoComplete="cc-number"
              value={cardNumber}
              disabled={submitting}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[15px] tracking-wide text-slate-900 outline-none ring-sky-400 placeholder:text-slate-300 focus:ring-2 disabled:opacity-60"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
                Expiry
              </span>
              <input
                type="text"
                inputMode="numeric"
                name="cc-exp"
                autoComplete="cc-exp"
                value={expiry}
                disabled={submitting}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[15px] text-slate-900 outline-none ring-sky-400 placeholder:text-slate-300 focus:ring-2 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-slate-600">
                CVC
              </span>
              <input
                type="password"
                inputMode="numeric"
                name="cc-csc"
                autoComplete="cc-csc"
                value={cvc}
                disabled={submitting}
                onChange={(e) =>
                  setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="123"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[15px] text-slate-900 outline-none ring-sky-400 placeholder:text-slate-300 focus:ring-2 disabled:opacity-60"
              />
            </label>
          </div>

          {error ? (
            <p className="text-[12px] font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Demo tips: any 16-digit card works · ends in 0000 = decline · ends
              in 0001 = pending
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[oklch(0.208_0.04_265.75)] text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-55"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Authorizing…" : `Pay ${session.priceLabel}`}
          </button>
        </form>

        <button
          type="button"
          disabled={submitting}
          onClick={() => choose("cancelled")}
          className="mt-3 h-11 text-[13px] text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          Cancel and return to Sugar
        </button>
      </div>
    </div>,
    document.body,
  );
}

function StatusOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/55 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center rounded-[24px] border border-white/10 bg-[oklch(0.191_0.01_303.57)] px-8 py-7 text-center shadow-2xl">
        <Loader2 className="size-8 animate-spin text-[oklch(0.811_0.101_293.57)]" aria-hidden="true" />
        <p className="mt-4 text-[15px] font-semibold">{title}</p>
        <p className="mt-1 max-w-[240px] text-[12px] text-white/45">{body}</p>
      </div>
    </div>
  );
}

function ResultModal({
  kind,
  title,
  body,
  onContinue,
  onRetry,
  retryLabel = "Try again",
}: {
  kind: "success" | "failed" | "cancelled" | "pending";
  title: string;
  body: string;
  onContinue: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const icon =
    kind === "success" ? (
      <Check className="size-5" />
    ) : kind === "pending" ? (
      <Clock className="size-5" />
    ) : (
      <XCircle className="size-5" />
    );

  const tone =
    kind === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : kind === "pending"
        ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
        : "border-[oklch(0.711_0.166_22.22)]/30 bg-[oklch(0.711_0.166_22.22)]/10 text-[oklch(0.711_0.166_22.22)]";

  return (
    <ModalShell onDismiss={onContinue}>
      <span
        className={["mx-auto grid size-12 place-items-center rounded-full border", tone].join(
          " ",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="mt-4 text-[18px] font-bold">{title}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-white/55">{body}</p>
      {kind === "success" || kind === "cancelled" ? (
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 h-12 w-full rounded-full bg-[oklch(0.606_0.219_292.72)] text-[14px] font-semibold transition active:scale-[0.98]"
        >
          Back to Store
        </button>
      ) : (
        <>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 h-12 w-full rounded-full bg-[oklch(0.606_0.219_292.72)] text-[14px] font-semibold transition active:scale-[0.98]"
            >
              {retryLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onContinue}
            className="mt-2 h-11 w-full text-[13px] text-white/55 hover:text-white/80"
          >
            Back to Store
          </button>
        </>
      )}
    </ModalShell>
  );
}

function ModalShell({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 px-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-[28px] border border-white/[0.1] bg-[oklch(0.191_0.01_303.57)] p-6 text-center shadow-[0_24px_60px_oklch(0_0_0_/_0.55)]"
      >
        {children}
      </div>
    </div>
  );
}
