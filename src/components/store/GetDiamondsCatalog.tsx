import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  Gift,
  Info,
  Loader2,
  Play,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { HistoryPageHeader } from "@/components/history/HistoryShared";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { useAuth } from "@/contexts/useAuth";
import { HubRedeemSection } from "@/components/rewards/HubRedeemSection";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import type { RedeemReward } from "@/services/redeem";
import {
  COIN_EXCHANGE_OPTIONS,
  COIN_PACK_FIXTURES,
  DAILY_AD_LIMIT,
  type StoreProduct,
} from "@/services/store";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "./GetDiamondsScreen.css";

const STORE_SQUIRCLE_CTA = ctaButtonPropsFromTemplate("squircleCTA");

type CashCurrency = "diamonds" | "coins";

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
  onBack,
  backLabel,
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
  onBack: () => void;
  backLabel?: string;
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
  const { authed } = useAuth();
  const [cashCurrency, setCashCurrency] = useState<CashCurrency>("diamonds");
  useEffect(() => {
    const sync = () => {
      document.documentElement.classList.toggle(
        "get-diamonds-anims-off",
        document.visibilityState === "hidden",
      );
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      document.documentElement.classList.remove("get-diamonds-anims-off");
    };
  }, []);
  const ads = products.filter((p) => p.kind === "rewarded-ad");
  const diamondPacks = products.filter((p) => p.kind === "diamonds");
  const liveCoinPacks = products.filter((p) => p.kind === "coins");
  // shortcut: live API may lack coin SKUs; fixture packs keep the Coins tab usable.
  const coinPacks = liveCoinPacks.length > 0 ? liveCoinPacks : COIN_PACK_FIXTURES;
  const packs = cashCurrency === "coins" ? coinPacks : diamondPacks;
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
      <HistoryPageHeader
        title={cashCurrency === "coins" ? "Buy Coins" : "Buy Diamonds"}
        onBack={onBack}
        backLabel={backLabel}
      />
      <div className="get-diamonds-ambient" aria-hidden="true">
        <span className="get-diamonds-ambient__orb get-diamonds-ambient__orb--a" />
        <span className="get-diamonds-ambient__orb get-diamonds-ambient__orb--b" />
        <span className="get-diamonds-ambient__sparkle" />
      </div>

      <section aria-label="Buy with Cash">
        <CashCurrencyToggle value={cashCurrency} onChange={setCashCurrency} />
        <PackageCarousel
          key={cashCurrency}
          packs={packs}
          busy={busy}
          isProcessing={isProcessing}
          onSelect={onSelect}
        />
      </section>

      <GetDiamondsHeroBand />

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
              disabled={authed ? busy || adRemaining <= 0 : false}
              onWatch={() => onSelect(adProduct)}
            />
          ) : null}
          {authed ? (
            <ExchangePanel
              coinBalance={coinBalance}
              exchangingId={exchangingId}
              disabled={busy}
              onExchange={onCoinExchange}
            />
          ) : null}
        </div>
      </section>

      {authed && onDiamondReward && onPackReward && onOpenPack ? (
        <HubRedeemSection
          heading="Redeem Code"
          onDiamondReward={onDiamondReward}
          onPackReward={onPackReward}
          onOpenPack={onOpenPack}
        />
      ) : null}
    </div>
  );
}

function CashCurrencyToggle({
  value,
  onChange,
}: {
  value: CashCurrency;
  onChange: (next: CashCurrency) => void;
}) {
  return (
    <div
      className="get-diamonds-currency-toggle"
      role="tablist"
      aria-label="Currency to buy"
    >
      <button
        type="button"
        role="tab"
        className={[
          "get-diamonds-currency-toggle__btn",
          value === "diamonds" ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-selected={value === "diamonds"}
        onClick={() => onChange("diamonds")}
      >
        <DiamondLottie size={16} aria-hidden />
        Diamonds
      </button>
      <button
        type="button"
        role="tab"
        className={[
          "get-diamonds-currency-toggle__btn",
          value === "coins" ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-selected={value === "coins"}
        onClick={() => onChange("coins")}
      >
        <CoinLottie size={16} aria-hidden />
        Coins
      </button>
    </div>
  );
}

/** Same Swiper coverflow pose as homepage `MobileCssCarousel`. */
function PackageCarousel({
  packs,
  busy,
  isProcessing,
  onSelect,
}: {
  packs: StoreProduct[];
  busy: boolean;
  isProcessing: (productId: string) => boolean;
  onSelect: (product: StoreProduct) => void;
}) {
  if (packs.length === 0) return null;

  return (
    <div className="get-diamonds-packages">
      <Swiper
        className="get-diamonds-packages-swiper"
        modules={[EffectCoverflow]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        spaceBetween={-72}
        speed={720}
        resistanceRatio={0.85}
        watchSlidesProgress
        noSwipingSelector=".get-diamonds-package__buy, .cta-button, .mcp-photo-play-cta-css-wrap"
        coverflowEffect={{
          rotate: 38,
          stretch: -88,
          depth: 80,
          scale: 0.9,
          modifier: 1,
          slideShadows: false,
        }}
        initialSlide={(() => {
          const best = packs.findIndex((p) => p.badge === "Best Value");
          return best >= 0 ? best : Math.floor(packs.length / 2);
        })()}
      >
        {packs.map((product) => (
          <SwiperSlide key={product.id} className="get-diamonds-packages-slide">
            <PackageCard
              product={product}
              processing={isProcessing(product.id)}
              disabled={busy}
              onBuy={() => onSelect(product)}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

function GetDiamondsHeroBand() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [motionLive, setMotionLive] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setMotionLive(Boolean(entry?.isIntersecting)),
      { rootMargin: "80px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={[
        "get-diamonds-hero-band",
        "get-diamonds-hero-band--art",
        motionLive ? "" : "is-paused",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="get-diamonds-hero-band__glow-wrap">
        <img
          className="get-diamonds-hero-band__glow"
          src="/images/store/glowCircle1x.webp"
          srcSet="/images/store/glowCircle1x.webp 1x, /images/store/glowCircle2x.webp 2x"
          alt=""
          decoding="async"
        />
      </div>
      <div className="get-diamonds-hero-band__float-wrap">
        <img
          className="get-diamonds-hero-band__float"
          src="/images/store/floatingDiamonds.webp"
          srcSet="/images/store/floatingDiamonds.webp 1x, /images/store/floatingDiamonds2x.webp 2x"
          alt=""
          decoding="async"
        />
      </div>
      <img
        className="get-diamonds-hero-band__woman"
        src="/images/store/diamondWoman1x.webp"
        srcSet="/images/store/diamondWoman1x.webp 1x, /images/store/diamondWoman2x.webp 2x"
        alt=""
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
  const isCoins = product.kind === "coins";
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
    !isCoins &&
    typeof product.bonusDiamonds === "number" &&
    product.bonusDiamonds > 0
      ? product.bonusDiamonds
      : null;
  const unit = isCoins ? "Coins" : "Diamonds";
  const amountValue = isCoins ? (product.coins ?? 0) : product.diamonds;
  const amount = amountValue.toLocaleString();
  const Mark = isCoins ? CoinLottie : DiamondLottie;

  return (
    <article
      className={[
        "get-diamonds-package",
        isCoins ? "is-coins" : "",
        featured ? "is-featured" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {product.badge ? (
        <span className={["get-diamonds-package__badge", badgeClass].join(" ")}>
          {product.badge}
        </span>
      ) : null}
      <p className="get-diamonds-package__kicker">
        <Mark size={18} aria-hidden />
        {isCoins ? "Coin Pack" : "Diamond Pack"}
      </p>
      <span className="get-diamonds-package__icon">
        {processing ? (
          <Loader2
            className="size-10 animate-spin text-sky-200"
            aria-hidden="true"
          />
        ) : (
          <Mark size={72} aria-hidden />
        )}
      </span>
      <div className="get-diamonds-package__amount-box">
        <span className="get-diamonds-package__amount-label">— Amount —</span>
        <p className="get-diamonds-package__amount">
          <Mark size={22} aria-hidden />
          {amount}
        </p>
        {bonus != null ? (
          <p className="get-diamonds-package__bonus">
            +{bonus.toLocaleString()} Bonus
          </p>
        ) : null}
      </div>
      <div className="get-diamonds-package__buy">
        <CtaButton
          forceCss
          cssTone={isCoins ? "gold" : "purple"}
          fillParent
          type="button"
          label={processing ? "Processing…" : product.priceLabel}
          costAmount={null}
          cornerRadius={999}
          strokeWidth={1}
          disabled={disabled}
          aria-busy={processing}
          aria-label={`Buy ${amount} ${unit} for ${product.priceLabel}`}
          onClick={onBuy}
        />
      </div>
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
            Exchange Coins for Diamonds
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
            ? `Exchange ${option.coins} Coins for ${option.diamonds} Diamonds`
            : `Requires ${option.coins} Coins for ${option.diamonds} Diamonds. Need ${missing} more Coins.`;
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
        Coins can be earned from gameplay, daily rewards, and events.
      </p>
    </div>
  );
}
