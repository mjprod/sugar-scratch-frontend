import {
  Check,
  Gift,
  Info,
  Loader2,
  Play,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { HubRedeemSection } from "@/components/rewards/HubRedeemSection";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import type { RedeemReward } from "@/services/redeem";
import {
  COIN_EXCHANGE_OPTIONS,
  DAILY_AD_LIMIT,
  type StoreProduct,
} from "@/services/store";
import "./GetDiamondsScreen.css";

const STORE_SQUIRCLE_CTA = ctaButtonPropsFromTemplate("squircleCTA");

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Secure payment" },
  { icon: Zap, label: "Instant delivery" },
  { icon: Check, label: "Trusted checkout" },
] as const;

/** Keep in sync with StoreScreen `Flow["step"]`. */
export type GetDiamondsFlowStep =
  | "idle"
  | "confirm"
  | "creating"
  | "gateway"
  | "verifying"
  | "result"
  | "ad-processing";

export function GetDiamondsCatalog({
  products,
  coinBalance,
  adClaimsToday,
  busy,
  activeProductId,
  flowStep,
  exchangingId,
  onSelect,
  onCoinExchange,
  onDiamondReward,
  onPackReward,
  onOpenPack,
}: {
  products: StoreProduct[];
  coinBalance: number;
  adClaimsToday: number;
  busy: boolean;
  activeProductId?: string;
  flowStep: GetDiamondsFlowStep;
  exchangingId?: string | null;
  onSelect: (product: StoreProduct) => void;
  onCoinExchange: (diamonds: number, coins: number) => boolean | Promise<boolean>;
  onDiamondReward?: (amount: number) => void;
  onPackReward?: (
    reward: Extract<RedeemReward, { type: "free_pack" }>,
  ) =>
    | { instanceId?: string }
    | Promise<{ instanceId?: string }>;
  onOpenPack?: (input: {
    packId: string;
    packName: string;
    creator: string;
    instanceId?: string;
  }) => void;
}) {
  const ads = products.filter((p) => p.kind === "rewarded-ad");
  const packs = products.filter((p) => p.kind === "diamonds");
  const adProduct = ads[0] ?? null;
  const adRemaining = Math.max(0, DAILY_AD_LIMIT - adClaimsToday);

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
    <div className="get-diamonds-stack">
      <div className="get-diamonds-ambient" aria-hidden="true">
        <span className="get-diamonds-ambient__orb get-diamonds-ambient__orb--a" />
        <span className="get-diamonds-ambient__orb get-diamonds-ambient__orb--b" />
        <span className="get-diamonds-ambient__sparkle" />
      </div>
      <GetDiamondsHeroBand />

      <section aria-labelledby="buy-cash-heading">
        <header className="get-diamonds-section__head">
          <h2 id="buy-cash-heading" className="get-diamonds-section__title">
            <Zap className="size-4" aria-hidden="true" />
            Buy with Cash
          </h2>
          <p className="get-diamonds-section__desc">
            Fast, secure and instant
          </p>
        </header>
        <div className="get-diamonds-packages">
          {packs.map((product) => (
            <PackageCard
              key={product.id}
              product={product}
              processing={isProcessing(product.id)}
              disabled={busy}
              onBuy={() => onSelect(product)}
            />
          ))}
        </div>
      </section>

      <TrustRow />

      <section aria-labelledby="earn-free-heading">
        <header className="get-diamonds-section__head">
          <h2 id="earn-free-heading" className="get-diamonds-section__title">
            <Gift className="size-4" aria-hidden="true" />
            Earn Diamonds for Free
          </h2>
        </header>
        <div className="get-diamonds-earn">
          {adProduct ? (
            <WatchAdPanel
              product={adProduct}
              processing={isProcessing(adProduct.id)}
              disabled={busy || adRemaining <= 0}
              onWatch={() => onSelect(adProduct)}
            />
          ) : null}
          <ExchangePanel
            coinBalance={coinBalance}
            exchangingId={exchangingId}
            disabled={busy}
            onExchange={onCoinExchange}
          />
        </div>
      </section>

      {onDiamondReward && onPackReward && onOpenPack ? (
        <HubRedeemSection
          heading="Redeem Code"
          onDiamondReward={onDiamondReward}
          onPackReward={onPackReward}
          onOpenPack={onOpenPack}
        />
      ) : null}

      <TrustRow footer />
    </div>
  );
}

function GetDiamondsHeroBand() {
  return (
    <div className="get-diamonds-hero-band">
      <header className="get-diamonds-hero get-diamonds-hero--band">
        <div className="get-diamonds-hero__copy-block">
          <h1 className="get-diamonds-hero__title">
            Get Diamonds <span className="get-diamonds-hero__accent">✦</span>
          </h1>
          <p className="get-diamonds-hero__copy">
            Diamonds are used to buy Motion Card Packs and unlock exclusive
            rewards.
          </p>
        </div>
      </header>
      <span className="get-diamonds-hero-band__sheen" aria-hidden="true" />
      <div className="get-diamonds-hero-band__glow-wrap" aria-hidden="true">
        <img
          className="get-diamonds-hero-band__glow"
          src="/images/store/glowCircle1x.webp"
          srcSet="/images/store/glowCircle1x.webp 1x, /images/store/glowCircle2x.webp 2x"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="get-diamonds-hero-band__float-wrap" aria-hidden="true">
        <img
          className="get-diamonds-hero-band__float"
          src="/images/store/floatingDiamonds.webp"
          srcSet="/images/store/floatingDiamonds.webp 1x, /images/store/floatingDiamonds2x.webp 2x"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <img
        className="get-diamonds-hero-band__woman"
        src="/images/store/diamondWoman1x.webp"
        srcSet="/images/store/diamondWoman1x.webp 1x, /images/store/diamondWoman2x.webp 2x"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function TrustRow({ footer }: { footer?: boolean }) {
  return (
    <ul
      className={["get-diamonds-trust", footer ? "is-footer" : ""].join(" ")}
      aria-label="Store trust information"
    >
      {TRUST_ITEMS.map(({ icon: Icon, label }) => (
        <li key={label} className="get-diamonds-trust__item">
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function PackageCard({
  product,
  processing,
  disabled,
  onBuy,
}: {
  product: StoreProduct;
  processing: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  const featured = product.badge === "Best Value";
  const badgeClass =
    product.badge === "Popular"
      ? "is-popular"
      : product.badge === "Best Value"
        ? "is-best"
        : product.badge === "Bonus"
          ? "is-bonus"
          : "";
  const bonus =
    typeof product.bonusDiamonds === "number" && product.bonusDiamonds > 0
      ? product.bonusDiamonds
      : null;

  return (
    <article
      className={["get-diamonds-package", featured ? "is-featured" : ""].join(
        " ",
      )}
    >
      {product.badge ? (
        <span className={["get-diamonds-package__badge", badgeClass].join(" ")}>
          {product.badge}
        </span>
      ) : null}
      <span className="get-diamonds-package__icon">
        {processing ? (
          <Loader2
            className="size-6 animate-spin text-sky-200"
            aria-hidden="true"
          />
        ) : (
          <DiamondLottie size={40} aria-hidden />
        )}
      </span>
      <p className="get-diamonds-package__amount">
        {product.diamonds.toLocaleString()}
      </p>
      <p className="get-diamonds-package__label">Diamonds</p>
      {bonus != null ? (
        <p className="get-diamonds-package__bonus">
          +{bonus.toLocaleString()} Bonus
        </p>
      ) : null}
      <p className="get-diamonds-package__price">{product.priceLabel}</p>
      {featured ? (
        <div className="get-diamonds-package__buy">
          <CtaButton
            {...STORE_SQUIRCLE_CTA}
            fillParent
            type="button"
            label={processing ? "Processing…" : "Buy"}
            costAmount={null}
            fontSize={15}
            cornerRadius={999}
            strokeWidth={1}
            disabled={disabled}
            aria-busy={processing}
            aria-label={`Buy ${product.diamonds} Diamonds`}
            onClick={onBuy}
          />
        </div>
      ) : (
        <button
          type="button"
          className="get-diamonds-package__buy get-diamonds-package__buy--outline"
          disabled={disabled}
          aria-busy={processing}
          aria-label={`Buy ${product.diamonds} Diamonds`}
          onClick={onBuy}
        >
          {processing ? "Processing…" : "Buy"}
        </button>
      )}
    </article>
  );
}

function WatchAdPanel({
  product,
  processing,
  disabled,
  onWatch,
}: {
  product: StoreProduct;
  processing: boolean;
  disabled: boolean;
  onWatch: () => void;
}) {
  return (
    <div className="get-diamonds-watch-ad">
      <div className="get-diamonds-watch-ad__body">
        <span className="get-diamonds-watch-ad__play" aria-hidden="true">
          <Play className="size-5" fill="currentColor" />
        </span>
        <h3 className="get-diamonds-watch-ad__title">Watch Ad</h3>
        <p className="get-diamonds-watch-ad__copy">
          Earn free Diamonds by watching short ads.
        </p>
        <p className="get-diamonds-watch-ad__reward">
          +{product.diamonds}
          <DiamondLottie size={28} aria-hidden />
        </p>
      </div>
      <div className="get-diamonds-watch-ad__cta">
        <CtaButton
          {...STORE_SQUIRCLE_CTA}
          fillParent
          type="button"
          label={processing ? "Loading ad…" : "▶ Watch Ad"}
          costAmount={null}
          fontSize={14}
          cornerRadius={999}
          disabled={disabled}
          aria-busy={processing}
          aria-label={`Watch an ad for ${product.diamonds} Diamonds`}
          onClick={onWatch}
        />
      </div>
    </div>
  );
}

function ExchangePanel({
  coinBalance,
  exchangingId,
  disabled,
  onExchange,
}: {
  coinBalance: number;
  exchangingId?: string | null;
  disabled: boolean;
  onExchange: (diamonds: number, coins: number) => boolean | Promise<boolean>;
}) {
  async function handleExchange(diamonds: number, coins: number) {
    if (coinBalance < coins) return;
    await onExchange(diamonds, coins);
  }

  return (
    <div className="get-diamonds-exchange">
      <div className="get-diamonds-exchange__head">
        <div>
          <h3 className="get-diamonds-section__title">
            <CoinLottie size={40} aria-hidden />
            Exchange Sugar Coins for Diamonds
          </h3>
        </div>
        <div className="get-diamonds-exchange__balance">
          Your Balance
          <div className="get-diamonds-exchange__balance-value">
            <CoinLottie size={28} aria-hidden />
            {coinBalance.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="get-diamonds-exchange__grid">
        {COIN_EXCHANGE_OPTIONS.map((option) => {
          const canAfford = coinBalance >= option.coins;
          const busy = exchangingId === option.id;
          const missing = Math.max(option.coins - coinBalance, 0);
          const ariaLabel = canAfford
            ? `Exchange ${option.coins} Sugar Coins for ${option.diamonds} Diamonds`
            : `Requires ${option.coins} Sugar Coins for ${option.diamonds} Diamonds. Need ${missing} more Sugar Coins.`;
          return (
            <div
              key={option.id}
              className={[
                "get-diamonds-exchange-card",
                canAfford ? "is-affordable" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="get-diamonds-exchange-card__reward">
                <DiamondLottie size={26} aria-hidden />
                <span className="get-diamonds-exchange-card__amount">
                  {option.diamonds.toLocaleString()}
                </span>
                <span className="get-diamonds-exchange-card__unit">
                  Diamonds
                </span>
              </div>
              <div
                className={[
                  "get-diamonds-exchange-card__btn",
                  canAfford ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <CtaButton
                  {...STORE_SQUIRCLE_CTA}
                  fillParent
                  type="button"
                  label={
                    busy ? "Exchanging…" : option.coins.toLocaleString()
                  }
                  costAmount={null}
                  leadingIcon={
                    busy ? undefined : <CoinLottie size={22} aria-hidden />
                  }
                  fontSize={13}
                  cornerRadius={999}
                  disabled={disabled || !canAfford || busy}
                  aria-label={ariaLabel}
                  onClick={() => handleExchange(option.diamonds, option.coins)}
                />
              </div>
              <p
                className="get-diamonds-exchange-card__need"
                aria-hidden={canAfford || missing <= 0}
              >
                {!canAfford && missing > 0
                  ? `Need ${missing.toLocaleString()} more`
                  : "\u00a0"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="get-diamonds-exchange__hint">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Sugar Coins can be earned from gameplay, daily rewards, and events.
      </p>
    </div>
  );
}
