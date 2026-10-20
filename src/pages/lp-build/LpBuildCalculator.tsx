import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import CountUp from "@/pages/lp-build/CountUp.jsx";

function formatFollowers(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

const TIPS = [
  "15% of the global population buys scratchies every week.",
  "Regular spenders can spend between $20-50 a month.",
  "You can earn from other influencers if you refer users",
] as const;

export function LpBuildCalculator({
  onContinue,
  parallax = 0,
}: {
  onContinue: () => void;
  parallax?: number;
}) {
  const fieldId = useId();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [followers, setFollowers] = useState("");
  const [focused, setFocused] = useState(false);
  const [percent, setPercent] = useState(11);
  const [period, setPeriod] = useState("Per Week");
  const [infoOpen, setInfoOpen] = useState(false);
  const [handleHeld, setHandleHeld] = useState(false);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const floating = focused || followers.length > 0;

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeInfo();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [closeInfo, infoOpen]);


  const HANDLE_MIN = 10;
  const HANDLE_SPAN = 80;
  const handleLeft = HANDLE_MIN + (percent / 100) * HANDLE_SPAN;
  const followerCount = Number(followers.replace(/\D/g, "")) || 0;
  const convertedCount = Math.round(followerCount * (percent / 100));
  const weeklyIncome = convertedCount * 15;
  const income =
    period === "Per Month"
      ? weeklyIncome * 4
      : period === "Per Year"
        ? weeklyIncome * 52
        : weeklyIncome;

  const setFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    const next = Math.round(((raw - HANDLE_MIN) / HANDLE_SPAN) * 100);
    setPercent(Math.min(100, Math.max(0, next)));
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setHandleHeld(true);
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setFromClientX(event.clientX);
  };

  const onPointerUp = () => setHandleHeld(false);

  return (
    <div className="lp-build-page3-wrap lp-build-page4">
      <div className="lp-build-page4-tip lp-build-page4-tip--mobile">
        <div className="lp-build-page4-tip-track">
          {[...TIPS, ...TIPS].map((copy, index) => (
            <p key={`mobile-${index}`}>{copy}</p>
          ))}
        </div>
      </div>
      <div
        className="lp-build-page3-headline"
        style={{ transform: `translate3d(0, ${-parallax * 0.22}px, 0)` }}
      >
        How much money could you earn?
        <button
          type="button"
          className="lp-build-page4-info-btn"
          aria-label="How it's calculated"
          onClick={() => setInfoOpen(true)}
        >
          <svg
            className="lp-build-page4-info-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M12.713 16.713Q13 16.425 13 16v-4q0-.425-.288-.712T12 11t-.712.288T11 12v4q0 .425.288.713T12 17t.713-.288m0-8Q13 8.425 13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9t.713-.288M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
            />
          </svg>
        </button>
      </div>
      {infoOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[1100] grid place-items-center bg-black/70 px-6 backdrop-blur-sm"
              onClick={closeInfo}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="lp-build-page4-dialog-title"
                className="w-full max-w-sm rounded-[28px] border border-white/[0.1] bg-[oklch(0.191_0.01_303.57)] p-6 text-center shadow-[0_24px_60px_oklch(0_0_0_/_0.55)]"
                onClick={(event) => event.stopPropagation()}
              >
                <h2
                  id="lp-build-page4-dialog-title"
                  className="text-[16px] text-white/85"
                >
                  How it's calculated
                </h2>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">
                  On average the user on our platform will spend $30 a week on
                  scratchies packs of which you recieve 50%
                </p>
                <div className="mt-6 h-12 w-full">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    label="Dismiss"
                    costAmount={null}
                    fontSize={14}
                    onClick={closeInfo}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div
        className="lp-build-page4-col"
        style={{ transform: `translate3d(0, ${-parallax * 0.22}px, 0)` }}
      >
        <div
          className={
            floating
              ? "lp-build-page4-field is-floating"
              : "lp-build-page4-field"
          }
        >
          <label htmlFor={fieldId}>Your Follower Count</label>
          <div className="lp-build-page4-field-body">
            <input
              id={fieldId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={followers}
              onChange={(event) => setFollowers(formatFollowers(event.target.value))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <p className="lp-build-page4-field-hint">* Choose your largest following</p>
          </div>
        </div>
        <div className="lp-build-page4-tip lp-build-page4-tip--desktop">
          <div className="lp-build-page4-tip-track">
            {[...TIPS, ...TIPS].map((copy, index) => (
              <p key={`desktop-${index}`}>{copy}</p>
            ))}
          </div>
        </div>
      </div>
      <div className="lp-build-page4-col lp-build-page4-col--right">
        <div
          className="lp-build-page4-convert-block"
          style={{ transform: `translate3d(0, ${-parallax * 0.38}px, 0)` }}
        >
          <div className="lp-build-page4-convert-body">
            <div className="lp-build-page4-row">
              <span className="lp-build-page4-row-title">If you convert…</span>
              <CountUp
                className="lp-build-page4-row-followers"
                to={convertedCount}
                mode="roll"
                easing="easeOut"
                format="standard"
                separator=","
                trigger="view"
                duration={0.5}
              />
            </div>
            <div
              ref={trackRef}
              className="lp-build-page4-progress"
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
              aria-label="Conversion percent"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setPercent((value) => Math.min(100, value + 1));
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  setPercent((value) => Math.max(0, value - 1));
                }
              }}
            >
              <span
                className="lp-build-page4-progress-fill"
                style={{ width: `max(13px, calc(${percent}% - 6px))` }}
              />
              <div
                className={
                  handleHeld
                    ? "lp-build-page4-progress-handle is-held"
                    : "lp-build-page4-progress-handle"
                }
                style={{ left: `${handleLeft}%` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  src="/svg/a41aef62cadef32aa43f992c427aebdbe9be59c4.svg"
                  alt=""
                  className="lp-build-page4-progress-caret"
                  draggable={false}
                  style={{ left: `${12 + (percent / 100) * 32}px` }}
                />
                <div className="lp-build-page4-progress-bubble">
                  <span className="lp-build-page4-progress-value">
                    {Math.round(percent)}
                  </span>
                  <span className="lp-build-page4-progress-suffix">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="lp-build-page4-income-block"
          style={{ transform: `translate3d(0, ${-parallax * 0.55}px, 0)` }}
        >
          <div className="lp-build-page4-income-copy">
            <div className="lp-build-page4-row lp-build-page4-row--income">
              <span className="lp-build-page4-row-title">
                Your income{" "}
                <span className="lp-build-page4-period">
                  <select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    aria-label="Income period"
                  >
                    <option>Per Week</option>
                    <option>Per Month</option>
                    <option>Per Year</option>
                  </select>
                </span>{" "}
                will be
              </span>
            </div>
            <p className="lp-build-page4-income">
              <CountUp
                to={Math.round(income)}
                mode="roll"
                easing="easeOut"
                format="standard"
                separator=","
                prefix={"$\u200A"}
                trigger="view"
                duration={0.5}
              />
            </p>
          </div>
          <div className="lp-build-page4-cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              label="Join for FREE"
              costAmount={null}
              fontSize={14}
              onClick={onContinue}
            />
          </div>
        </div>
      </div>
      <div
        className={
          handleHeld
            ? "lp-build-page4-percent-overlay is-in"
            : "lp-build-page4-percent-overlay"
        }
        aria-hidden="true"
      >
        <div className="lp-build-page4-percent-box glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-50 glass-surface">
          <span>{Math.round(percent)}</span>
          <span>%</span>
        </div>
      </div>
    </div>
  );
}
