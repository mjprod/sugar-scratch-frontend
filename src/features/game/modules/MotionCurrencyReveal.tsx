import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { lottieRenderConfig } from "@/utils/lottieRender";

const YOU_WIN_LOTTIE_SRC = "/lottie/lottieYouWinText.lottie";
const WIN_BG = "/images/imageWinBg";
const WON_IN_MS = 840;
/** Covers the 1.22 bounce peak after the bitmap is sized at scale(1). */
const WON_EXTRA_SCALE = 3;
const WON_IN_FRAMES: Keyframe[] = [
  { transform: "scale(0)", opacity: 1, offset: 0 },
  { transform: "scale(0.14)", opacity: 1, offset: 0.14 },
  { transform: "scale(0)", opacity: 1, offset: 0.22 },
  { transform: "scale(1.22)", opacity: 1, offset: 0.52 },
  { transform: "scale(0.88)", opacity: 1, offset: 0.66 },
  { transform: "scale(1.08)", opacity: 1, offset: 0.8 },
  { transform: "scale(0.97)", opacity: 1, offset: 0.9 },
  { transform: "scale(1)", opacity: 1, offset: 1 },
];

export type MotionCurrencyRevealProps = {
  coins: number;
  diamonds: number;
  /** Stable id for this result — prevents replay on parent re-render. */
  resultId: string;
  onComplete: () => void;
};

type Phase =
  | "entering"
  | "appearing"
  | "confirmed"
  | "minimizing"
  | "complete";

/** Per-card currency result hold before auto-advance to the next motion card. */
export const CARD_CURRENCY_RESULT_MS = 8000;
const SAFETY_MS = CARD_CURRENCY_RESULT_MS + 800;
const COUNT_MS = 900;
/** Temporary: stay up until Skip so we can inspect the layout. */
const HOLD_UNTIL_DISMISS = true;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, active: boolean, durationMs: number) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (!active || target <= 0) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const from = 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = Math.round(from + (target - from) * easeOutCubic(t));
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs, target]);

  return display;
}

/**
 * Per-card coin + diamond win reveal — presentation only.
 * Session/wallet rewards must already be persisted before this mounts.
 * Auto-advances after 8s (or Skip); navigation is handled by the parent.
 */
export function MotionCurrencyReveal({
  coins,
  diamonds,
  resultId,
  onComplete,
}: MotionCurrencyRevealProps) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [wonBox, setWonBox] = useState({ w: 0, h: 0 });
  const completedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const wonPlayerRef = useRef<DotLottie | null>(null);
  const wonBoxRef = useRef<HTMLDivElement | null>(null);
  const wonAnimRef = useRef<Animation | null>(null);
  const wonScaleDoneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const wonRenderConfig = useMemo(
    () => lottieRenderConfig({ extraScale: WON_EXTRA_SCALE, autoResize: false }),
    [],
  );

  function playWonLottie() {
    const player = wonPlayerRef.current;
    if (!player) return;
    try {
      player.setLoop(true);
      void player.play();
    } catch {
      /* player may not be ready yet */
    }
  }
  const reduced = prefersReducedMotion();
  const counting = phase === "appearing" || phase === "confirmed";
  const coinDisplay = useCountUp(coins, counting, COUNT_MS);
  const diamondDisplay = useCountUp(diamonds, counting, COUNT_MS);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  function finish() {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTimers();
    setPhase("complete");
    onCompleteRef.current();
  }

  function skipNow() {
    if (completedRef.current) return;
    clearTimers();
    setPhase("minimizing");
    timersRef.current.push(
      window.setTimeout(finish, reduced ? 120 : 280),
    );
  }

  useEffect(() => {
    completedRef.current = false;
    wonScaleDoneRef.current = false;
    wonAnimRef.current?.cancel();
    wonAnimRef.current = null;
    setWonBox({ w: 0, h: 0 });
    setPhase("entering");
    clearTimers();

    const at = (ms: number, fn: () => void) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };

    const holdMs = reduced ? 2500 : CARD_CURRENCY_RESULT_MS;

    if (HOLD_UNTIL_DISMISS) {
      at(reduced ? 120 : 200, () => setPhase("appearing"));
      at(reduced ? 500 : 900, () => setPhase("confirmed"));
      return () => clearTimers();
    }

    if (reduced) {
      at(120, () => setPhase("appearing"));
      at(500, () => setPhase("confirmed"));
      at(holdMs - 200, () => setPhase("minimizing"));
      at(holdMs, finish);
      at(SAFETY_MS, finish);
      return () => clearTimers();
    }

    at(200, () => setPhase("appearing"));
    at(900, () => setPhase("confirmed"));
    at(holdMs - 400, () => setPhase("minimizing"));
    at(holdMs, finish);
    at(SAFETY_MS, finish);

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart timeline per resultId
  }, [resultId]);

  const showHeader =
    phase !== "entering" && phase !== "minimizing" && phase !== "complete";
  const showMini = phase === "minimizing" || phase === "complete";
  const showSkip =
    phase === "appearing" || phase === "confirmed";
  const fading = phase === "complete";
  const showCoins = coins > 0;
  const showDiamonds = diamonds > 0;

  useLayoutEffect(() => {
    if (!showHeader || reduced) return;
    const el = wonBoxRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w <= 0 || h <= 0) return;
      setWonBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showHeader, reduced, resultId]);

  return (
    <div
      className={[
        "motion-currency-reveal",
        `is-${phase}`,
        reduced ? "is-reduced" : "",
        fading ? "is-fading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={[
        coins > 0 ? `${coins} coin${coins === 1 ? "" : "s"}` : null,
        diamonds > 0
          ? `${diamonds} diamond${diamonds === 1 ? "" : "s"}`
          : null,
      ]
        .filter(Boolean)
        .join(" and ")}
    >
      <div className="motion-currency-reveal__backdrop" aria-hidden="true" />
      <div className="motion-currency-reveal__art" aria-hidden="true">
        <picture>
          <source
            type="image/jxl"
            srcSet={`${WIN_BG}@1x.jxl 1x, ${WIN_BG}@2x.jxl 2x`}
          />
          <source
            type="image/webp"
            srcSet={`${WIN_BG}@1x.webp 1x, ${WIN_BG}@2x.webp 2x`}
          />
          <img
            src={`${WIN_BG}@1x.webp`}
            srcSet={`${WIN_BG}@1x.webp 1x, ${WIN_BG}@2x.webp 2x`}
            alt=""
            draggable={false}
            decoding="async"
          />
        </picture>
      </div>
      <div className="motion-currency-reveal__mesh" aria-hidden="true">
        <div className="motion-currency-reveal__mesh-pair is-top-right">
          <span className="motion-currency-reveal__mesh-orb is-a" />
          <span className="motion-currency-reveal__mesh-orb is-b" />
        </div>
        <div className="motion-currency-reveal__mesh-pair is-bottom-left">
          <span className="motion-currency-reveal__mesh-orb is-a" />
          <span className="motion-currency-reveal__mesh-orb is-b" />
        </div>
      </div>
      <div className="motion-currency-reveal__particles" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>

      <div className="motion-currency-reveal__center">
        {showHeader ? (
          <div className="motion-currency-reveal__header">
            {reduced ? (
              <p className="motion-currency-reveal__won is-text">YOU WON!</p>
            ) : (
              <>
                <div
                  ref={wonBoxRef}
                  className="motion-currency-reveal__won"
                  aria-hidden="true"
                >
                  {wonBox.w > 0 ? (
                    <DotLottieReact
                      src={YOU_WIN_LOTTIE_SRC}
                      autoplay={false}
                      loop
                      className="motion-currency-reveal__won-player"
                      renderConfig={wonRenderConfig}
                      dotLottieRefCallback={(player) => {
                        if (!player) return;
                        wonPlayerRef.current = player;
                        const hooked = player as DotLottie & {
                          __wonHooked?: boolean;
                        };
                        if (hooked.__wonHooked) {
                          if (wonScaleDoneRef.current) playWonLottie();
                          return;
                        }
                        hooked.__wonHooked = true;
                        wonAnimRef.current?.cancel();
                        wonAnimRef.current = null;
                        wonScaleDoneRef.current = false;
                        const startBounce = () => {
                          const host = wonBoxRef.current;
                          if (!host || wonAnimRef.current) return;
                          // Size the bitmap at scale(1) — resize() reads
                          // getBoundingClientRect, which includes WAAPI scale.
                          try {
                            player.resize();
                          } catch {
                            /* player may not be ready yet */
                          }
                          const anim = host.animate(WON_IN_FRAMES, {
                            duration: WON_IN_MS,
                            easing: "linear",
                            fill: "forwards",
                          });
                          wonAnimRef.current = anim;
                          anim.onfinish = () => {
                            wonScaleDoneRef.current = true;
                            playWonLottie();
                          };
                        };
                        player.addEventListener("load", startBounce);
                        if (player.isLoaded) startBounce();
                      }}
                    />
                  ) : null}
                </div>
                <p className="sr-only">YOU WON!</p>
              </>
            )}
            <p className="motion-currency-reveal__count">
              {showDiamonds ? (
                <span className="motion-currency-reveal__count-prize">
                  {diamonds} Diamond{diamonds === 1 ? "" : "s"}
                </span>
              ) : null}
              {showDiamonds && showCoins ? " · " : null}
              {showCoins ? (
                <span>
                  {coins} Coin{coins === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        <div
          className={[
            "motion-currency-reveal__stack",
            showCoins && showDiamonds ? "has-both" : "",
            phase === "appearing" ||
            phase === "confirmed" ||
            phase === "minimizing"
              ? "is-visible"
              : "",
            showMini ? "is-minimizing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showDiamonds ? (
            <div className="motion-currency-reveal__hero is-diamonds">
              <div className="motion-currency-reveal__stack-col">
                <div className="motion-currency-reveal__icon" aria-hidden="true">
                  <DiamondLottie size={130} animated />
                </div>
                <p className="motion-currency-reveal__amount tabular-nums">
                  {diamondDisplay}
                </p>
                <p className="motion-currency-reveal__label">
                  {diamonds === 1 ? "Diamond" : "Diamonds"}
                </p>
              </div>
            </div>
          ) : null}
          {showCoins ? (
            <div className="motion-currency-reveal__hero is-coins">
              <div className="motion-currency-reveal__pair">
                <div className="motion-currency-reveal__icon" aria-hidden="true">
                  <CoinLottie
                    size={88}
                    extraScale={2}
                    eager
                    loop
                    autoplay
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
                <div className="motion-currency-reveal__stack-col">
                  <p className="motion-currency-reveal__amount tabular-nums">
                    {coinDisplay}
                  </p>
                  <p className="motion-currency-reveal__label">Coins</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showSkip ? (
        <div className="motion-currency-reveal__actions">
          <div className="motion-currency-reveal__cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              type="button"
              label="Next Card"
              costAmount={null}
              strokeWidth={1}
              onClick={skipNow}
            />
          </div>
        </div>
      ) : null}

      <div
        className={[
          "motion-currency-reveal__mini",
          showMini ? "is-shown" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!showMini}
      >
        {showDiamonds ? (
          <>
            <span className="motion-currency-reveal__mini-icon" aria-hidden="true">
              <DiamondLottie size={22} />
            </span>
            <span className="motion-currency-reveal__mini-new">+{diamonds}</span>
          </>
        ) : null}
        {showCoins ? (
          <>
            <span className="motion-currency-reveal__mini-icon" aria-hidden="true">
              <CoinLottie size={22} eager loop={false} autoplay />
            </span>
            <span className="motion-currency-reveal__mini-new">+{coins}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
