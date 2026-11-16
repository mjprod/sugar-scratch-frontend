import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Check,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { HistoryPageHeader } from "@/components/history/HistoryShared";
import { useAuth } from "@/contexts/useAuth";
import { CurrencyPackCard } from "@/components/currency-pack-card/CurrencyPackCard";
import { HubRedeemSection } from "@/components/rewards/HubRedeemSection";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { useMotionOptional } from "@/features/collection/context/MotionContext";
import type { RedeemReward } from "@/services/redeem";
import {
  COIN_EXCHANGE_OPTIONS,
  type CoinExchangeOption,
  type StoreBadge,
  type StoreProduct,
} from "@/services/store";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "./GetDiamondsScreen.css";

/** Hero band parallax — same family as SpotlightBanner / shop influencer backdrop. */
const HERO_TILT_MAX_X_PX = 36;
const HERO_TILT_MAX_Y_PX = 40;
const HERO_TILT_GAMMA_RANGE = 28;
const HERO_TILT_BETA_RANGE = 24;
const HERO_TILT_LERP = 0.05;

function clampNorm(n: number) {
  return Math.max(-1, Math.min(1, n));
}

function PackagesShell({
  children,
  fadeLeft = false,
  fadeRight = false,
}: {
  children: ReactNode;
  fadeLeft?: boolean;
  fadeRight?: boolean;
}) {
  return (
    <div
      className={[
        "get-diamonds-packages",
        fadeLeft ? "has-fade-left" : "",
        fadeRight ? "has-fade-right" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

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
  const diamondPacks = products.filter((p) => p.kind === "diamonds");

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
    <div className="get-diamonds-stack" data-currency={cashCurrency}>
      <HistoryPageHeader
        title={cashCurrency === "coins" ? "Coin Swap" : "Buy Diamonds"}
        onBack={onBack}
        backLabel={backLabel}
      />
      <div className="get-diamonds-ambient" aria-hidden="true">
        <span className="get-diamonds-ambient__orb get-diamonds-ambient__orb--a" />
        <span className="get-diamonds-ambient__orb get-diamonds-ambient__orb--b" />
        <span className="get-diamonds-ambient__sparkle" />
      </div>

      <section
        aria-label={
          cashCurrency === "coins" ? "Coin Swap" : "Buy with Cash"
        }
      >
        <CashCurrencyToggle value={cashCurrency} onChange={setCashCurrency} />
        {cashCurrency === "coins" ? (
          <CoinSwapCarousel
            options={COIN_EXCHANGE_OPTIONS}
            busy={busy}
            exchangingId={exchangingId}
            coinBalance={coinBalance}
            onSwap={onCoinExchange}
          />
        ) : (
          <PackageCarousel
            packs={diamondPacks}
            busy={busy}
            isProcessing={isProcessing}
            onSelect={onSelect}
          />
        )}
      </section>

      <GetDiamondsHeroBand />

      {authed && onDiamondReward && onPackReward && onOpenPack ? (
        <HubRedeemSection
          heading="Redeem Code"
          onDiamondReward={onDiamondReward}
          onPackReward={onPackReward}
          onOpenPack={onOpenPack}
        />
      ) : null}

      <TrustRow />
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
  const rootRef = useRef<HTMLDivElement>(null);
  const diamondsRef = useRef<HTMLButtonElement>(null);
  const coinsRef = useRef<HTMLButtonElement>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    grabOffsetX: number;
    startX: number;
    moved: boolean;
    width: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bubble, setBubble] = useState({ x: 0, w: 0, ready: false });

  const buttonFor = (next: CashCurrency) =>
    next === "coins" ? coinsRef.current : diamondsRef.current;

  const syncBubble = (next: CashCurrency = value) => {
    const root = rootRef.current;
    const btn = buttonFor(next);
    if (!root || !btn) return;
    const rootRect = root.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setBubble({
      x: btnRect.left - rootRect.left,
      w: btnRect.width,
      ready: true,
    });
  };

  useEffect(() => {
    syncBubble(value);
  }, [value]);

  useEffect(() => {
    const onResize = () => syncBubble(value);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  function nearestCurrency(clientX: number): CashCurrency {
    const diamonds = diamondsRef.current?.getBoundingClientRect();
    const coins = coinsRef.current?.getBoundingClientRect();
    if (!diamonds || !coins) return value;
    const dDist = Math.abs(clientX - (diamonds.left + diamonds.width / 2));
    const cDist = Math.abs(clientX - (coins.left + coins.width / 2));
    const dHit = clientX >= diamonds.left && clientX <= diamonds.right;
    const cHit = clientX >= coins.left && clientX <= coins.right;
    // Same scoring as dock `findNearestTab`: prefer hit, else nearest center.
    const dScore = dHit ? dDist * 0.25 : dDist;
    const cScore = cHit ? cDist * 0.25 : cDist;
    return dScore <= cScore ? "diamonds" : "coins";
  }

  function select(next: CashCurrency) {
    if (suppressClickRef.current) return;
    onChange(next);
  }

  return (
    <div
      ref={rootRef}
      className={[
        "get-diamonds-currency-toggle",
        dragging ? "is-dragging" : "",
        bubble.ready ? "is-bubble-ready" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-value={value}
      role="tablist"
      aria-label="Currency to buy"
      style={
        {
          "--currency-bubble-x": `${bubble.x}px`,
          "--currency-bubble-w": `${bubble.w}px`,
        } as CSSProperties
      }
    >
      <span
        className="get-diamonds-currency-toggle__bubble-glow"
        aria-hidden
      />
      <span className="get-diamonds-currency-toggle__bubble" aria-hidden />
      <div
        className="get-diamonds-currency-toggle__bubble-handle"
        role="slider"
        tabIndex={0}
        aria-label="Drag currency indicator"
        aria-valuetext={value === "coins" ? "Coins" : "Diamonds"}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const root = rootRef.current;
          if (!root || !bubble.ready) return;
          const rootRect = root.getBoundingClientRect();
          dragRef.current = {
            pointerId: event.pointerId,
            grabOffsetX: event.clientX - rootRect.left - bubble.x,
            startX: event.clientX,
            moved: false,
            width: bubble.w,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          const root = rootRef.current;
          if (!drag || !root || event.pointerId !== drag.pointerId) return;
          if (!drag.moved && Math.abs(event.clientX - drag.startX) > 4) {
            drag.moved = true;
          }
          const rootRect = root.getBoundingClientRect();
          const minX = diamondsRef.current
            ? diamondsRef.current.getBoundingClientRect().left - rootRect.left
            : 0;
          const maxX = coinsRef.current
            ? coinsRef.current.getBoundingClientRect().left - rootRect.left
            : minX;
          const nextX = Math.min(
            maxX,
            Math.max(minX, event.clientX - rootRect.left - drag.grabOffsetX),
          );
          setBubble((prev) => ({
            ...prev,
            x: nextX,
            w: drag.width,
            ready: true,
          }));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || event.pointerId !== drag.pointerId) return;
          const moved = drag.moved;
          dragRef.current = null;
          setDragging(false);
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            /* already released */
          }
          if (moved) {
            suppressClickRef.current = true;
            window.setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
            const next = nearestCurrency(event.clientX);
            onChange(next);
            syncBubble(next);
            return;
          }
          syncBubble(value);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragging(false);
          syncBubble(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            onChange(event.key === "ArrowRight" ? "coins" : "diamonds");
          }
        }}
      />
      <button
        ref={diamondsRef}
        type="button"
        role="tab"
        className={[
          "get-diamonds-currency-toggle__btn",
          value === "diamonds" ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-selected={value === "diamonds"}
        onClick={() => select("diamonds")}
      >
        <DiamondLottie size={16} aria-hidden />
        Diamonds
      </button>
      <button
        ref={coinsRef}
        type="button"
        role="tab"
        className={[
          "get-diamonds-currency-toggle__btn",
          value === "coins" ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-selected={value === "coins"}
        onClick={() => select("coins")}
      >
        <CoinLottie size={16} aria-hidden />
        Coins
      </button>
    </div>
  );
}

const PACKAGE_COVERFLOW = {
  rotate: 38,
  stretch: -70,
  depth: 64,
  scale: 0.9,
  modifier: 1,
  slideShadows: false,
} as const;

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
  const initialSlide = (() => {
    const best = packs.findIndex((p) => p.badge === "Best Value");
    return best >= 0 ? best : Math.floor(packs.length / 2);
  })();
  const [activeIndex, setActiveIndex] = useState(initialSlide);
  const [swiping, setSwiping] = useState(false);

  if (packs.length === 0) return null;

  return (
    <PackagesShell
      fadeLeft={activeIndex > 0}
      fadeRight={activeIndex < packs.length - 1}
    >
      <Swiper
        className="get-diamonds-packages-swiper"
        modules={[EffectCoverflow]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        spaceBetween={-58}
        speed={720}
        resistanceRatio={0.85}
        watchSlidesProgress
        noSwipingSelector=".currency-pack-card__buy, .cta-button, .mcp-photo-play-cta-css-wrap"
        coverflowEffect={PACKAGE_COVERFLOW}
        initialSlide={initialSlide}
        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        onTouchStart={() => setSwiping(true)}
        onTouchEnd={() => setSwiping(false)}
        onTransitionEnd={() => setSwiping(false)}
      >
        {packs.map((product, index) => (
          <SwiperSlide key={product.id} className="get-diamonds-packages-slide">
            <PackageCard
              product={product}
              processing={isProcessing(product.id)}
              disabled={busy}
              iconsAnimated={!swiping && index === activeIndex}
              onBuy={() => onSelect(product)}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </PackagesShell>
  );
}

function coinSwapBadge(
  option: CoinExchangeOption,
  index: number,
  total: number,
): StoreBadge | null {
  if (index === Math.floor(total / 2)) return "Best Value";
  if (index === 1) return "Popular";
  return null;
}

/** Coin Swap coverflow — whole-coin costs from exchange tiers (not cash decimals). */
function CoinSwapCarousel({
  options,
  busy,
  exchangingId,
  coinBalance,
  onSwap,
}: {
  options: readonly CoinExchangeOption[];
  busy: boolean;
  exchangingId?: string | null;
  coinBalance: number;
  onSwap: (diamonds: number, coins: number) => boolean | Promise<boolean>;
}) {
  const initialSlide = Math.floor(options.length / 2);
  const [activeIndex, setActiveIndex] = useState(initialSlide);
  const [swiping, setSwiping] = useState(false);

  if (options.length === 0) return null;

  return (
    <PackagesShell
      fadeLeft={activeIndex > 0}
      fadeRight={activeIndex < options.length - 1}
    >
      <Swiper
        className="get-diamonds-packages-swiper"
        modules={[EffectCoverflow]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        spaceBetween={-58}
        speed={720}
        resistanceRatio={0.85}
        watchSlidesProgress
        noSwipingSelector=".currency-pack-card__buy, .cta-button, .mcp-photo-play-cta-css-wrap"
        coverflowEffect={PACKAGE_COVERFLOW}
        initialSlide={initialSlide}
        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        onTouchStart={() => setSwiping(true)}
        onTouchEnd={() => setSwiping(false)}
        onTransitionEnd={() => setSwiping(false)}
      >
        {options.map((option, index) => {
          const badge = coinSwapBadge(option, index, options.length);
          const affordable = coinBalance >= option.coins;
          return (
            <SwiperSlide
              key={option.id}
              className="get-diamonds-packages-slide"
            >
              <CurrencyPackCard
                currency="coins"
                amount={option.diamonds}
                priceLabel={option.coins.toLocaleString("en-US")}
                badge={badge}
                featured={badge === "Best Value"}
                processing={exchangingId === option.id}
                disabled={busy || !affordable}
                iconsAnimated={!swiping && index === activeIndex}
                onBuy={() => {
                  void onSwap(option.diamonds, option.coins);
                }}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>
    </PackagesShell>
  );
}

function GetDiamondsHeroBand() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [motionLive, setMotionLive] = useState(true);
  const motion = useMotionOptional();
  const tiltOn = Boolean(motion?.enabled && motion.permission === "granted");

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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const clear = () => {
      root.style.setProperty("--hero-tilt-x", "0px");
      root.style.setProperty("--hero-tilt-y", "0px");
    };

    if (
      !tiltOn ||
      !motion ||
      !motionLive ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      clear();
      return;
    }

    let x = 0;
    let y = 0;
    return motion.subscribe((sample) => {
      if (!sample.hasSample) return;
      const yawNorm = clampNorm(sample.gamma / HERO_TILT_GAMMA_RANGE);
      const pitchNorm = clampNorm((sample.beta - 55) / HERO_TILT_BETA_RANGE);
      // Invert so phone-left / tip-toward shifts the scene the other way (parallax).
      const targetX = -yawNorm * HERO_TILT_MAX_X_PX;
      const targetY = -pitchNorm * HERO_TILT_MAX_Y_PX;
      x += (targetX - x) * HERO_TILT_LERP;
      y += (targetY - y) * HERO_TILT_LERP;
      root.style.setProperty("--hero-tilt-x", `${x.toFixed(2)}px`);
      root.style.setProperty("--hero-tilt-y", `${y.toFixed(2)}px`);
    });
  }, [motion, motionLive, tiltOn]);

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
      <div className="get-diamonds-hero-band__bg" />
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
  iconsAnimated,
  onBuy,
}: {
  product: StoreProduct;
  processing: boolean;
  disabled: boolean;
  iconsAnimated?: boolean;
  onBuy: () => void;
}) {
  return (
    <CurrencyPackCard
      currency="diamonds"
      amount={product.diamonds}
      priceLabel={product.priceLabel}
      badge={product.badge}
      featured={product.badge === "Best Value"}
      processing={processing}
      disabled={disabled}
      iconsAnimated={iconsAnimated}
      onBuy={onBuy}
    />
  );
}

