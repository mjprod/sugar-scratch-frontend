import { Gem, Gift, Loader2, Play, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
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
import { GetDiamondsHeroVisual } from "@/components/store/GetDiamondsHeroVisual";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Secure payment" },
  { icon: Zap, label: "Instant delivery" },
  { icon: Sparkles, label: "Trusted checkout" },
] as const;

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
  flowStep: string;
  exchangingId?: string | null;
  onSelect: (product: StoreProduct) => void;
  onCoinExchange: (diamonds: number, coins: number) => boolean;
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
      <GetDiamondsHero />

      <section aria-labelledby="buy-cash-heading">
        <header className="get-diamonds-section__head">
          <h2 id="buy-cash-heading" className="get-diamonds-section__title">
            <Gem className="size-4" aria-hidden="true" />
            Buy with Cash
          </h2>
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
          <p className="get-diamonds-section__desc">
            Play, watch and exchange to earn Diamonds.
          </p>
        </header>
        <div className="get-diamonds-earn">
          {adProduct ? (
            <WatchAdPanel
              product={adProduct}
              remaining={adRemaining}
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
          onDiamondReward={onDiamondReward}
          onPackReward={onPackReward}
          onOpenPack={onOpenPack}
        />
      ) : null}

      <TrustRow footer />
    </div>
  );
}

function GetDiamondsHero() {
  return (
    <header className="get-diamonds-hero">
      <div className="get-diamonds-hero__copy-block">
        <p className="get-diamonds-hero__eyebrow">Sugar currency hub</p>
        <h1 className="get-diamonds-hero__title">
          Get Diamonds <span className="get-diamonds-hero__accent">✦</span>
        </h1>
        <p className="get-diamonds-hero__copy">
          Diamonds are used to buy Motion Card Packs and unlock exclusive
          rewards.
        </p>
      </div>
      <GetDiamondsHeroVisual />
    </header>
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

  return (
    <article
      className={["get-diamonds-package", featured ? "is-featured" : ""].join(" ")}
    >
      {product.badge ? (
        <span className={["get-diamonds-package__badge", badgeClass].join(" ")}>
          {product.badge}
        </span>
      ) : null}
      <span className="get-diamonds-package__icon">
        {processing ? (
          <Loader2 className="size-6 animate-spin text-sky-200" aria-hidden="true" />
        ) : (
          <DiamondLottie size={40} aria-hidden />
        )}
      </span>
      <p className="get-diamonds-package__amount">
        {product.diamonds.toLocaleString()}
      </p>
      <p className="get-diamonds-package__label">Diamonds</p>
      {product.coins ? (
        <p className="get-diamonds-package__bonus">
          +{product.coins.toLocaleString()} Coins
        </p>
      ) : null}
      <p className="get-diamonds-package__price">{product.priceLabel}</p>
      <button
        type="button"
        className="get-diamonds-package__buy"
        disabled={disabled}
        aria-busy={processing}
        aria-label={`Buy ${product.diamonds} Diamonds`}
        onClick={onBuy}
      >
        {processing ? "Processing…" : "Buy"}
      </button>
    </article>
  );
}

function WatchAdPanel({
  product,
  remaining,
  processing,
  disabled,
  onWatch,
}: {
  product: StoreProduct;
  remaining: number;
  processing: boolean;
  disabled: boolean;
  onWatch: () => void;
}) {
  return (
    <div className="get-diamonds-watch-ad">
      <h3 className="get-diamonds-watch-ad__title">Watch Ad</h3>
      <p className="get-diamonds-watch-ad__copy">
        Earn free Diamonds by watching short ads.
      </p>
      <span className="get-diamonds-watch-ad__limit">
        Daily limit {remaining}/{DAILY_AD_LIMIT}
      </span>
      <p className="get-diamonds-watch-ad__reward">
        +{product.diamonds}
        <DiamondLottie size={28} aria-hidden />
      </p>
      <button
        type="button"
        className="get-diamonds-watch-ad__cta"
        disabled={disabled}
        aria-busy={processing}
        aria-label={`Watch an ad for ${product.diamonds} Diamonds`}
        onClick={onWatch}
      >
        {processing ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading ad…
          </>
        ) : (
          <>
            <Play className="size-4" aria-hidden="true" fill="currentColor" />
            Watch Ad
          </>
        )}
      </button>
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
  onExchange: (diamonds: number, coins: number) => boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);

  function handleExchange(diamonds: number, coins: number) {
    setMessage(null);
    if (coinBalance < coins) {
      setMessage("Not enough Sugar Coins.");
      return;
    }
    const ok = onExchange(diamonds, coins);
    if (ok) {
      setMessage(`+${diamonds} Diamonds added ✦`);
    }
  }

  return (
    <div className="get-diamonds-exchange">
      <div className="get-diamonds-exchange__head">
        <div>
          <h3 className="get-diamonds-section__title">Exchange Sugar Coins</h3>
          <p className="get-diamonds-section__desc">
            Use your Sugar Coins to exchange for Diamonds.
          </p>
        </div>
        <div className="get-diamonds-exchange__balance">
          Your balance
          <div className="get-diamonds-exchange__balance-value">
            {coinBalance.toLocaleString()}
            <CoinLottie size={18} aria-hidden />
          </div>
        </div>
      </div>
      <div className="get-diamonds-exchange__grid">
        {COIN_EXCHANGE_OPTIONS.map((option) => {
          const canAfford = coinBalance >= option.coins;
          const busy = exchangingId === option.id;
          return (
            <div key={option.id} className="get-diamonds-exchange-card">
              <p className="get-diamonds-exchange-card__diamonds">
                {option.diamonds.toLocaleString()}
              </p>
              <p className="get-diamonds-exchange-card__coins">
                {option.coins.toLocaleString()} Coins
              </p>
              <button
                type="button"
                className="get-diamonds-exchange-card__btn"
                disabled={disabled || !canAfford || busy}
                aria-label={`Exchange ${option.coins} Sugar Coins for ${option.diamonds} Diamonds`}
                onClick={() => handleExchange(option.diamonds, option.coins)}
              >
                {busy ? "Exchanging…" : canAfford ? "Exchange" : "Not enough"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="get-diamonds-exchange__hint">
        Sugar Coins can be earned from gameplay, daily rewards and events.
      </p>
      {message ? (
        <p className="get-diamonds-exchange__hint" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
