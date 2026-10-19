import { useCallback, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import CountUp from "@/pages/lp-build/CountUp.jsx";
import { LpBuildShell } from "@/pages/lp-build/LpBuildShell";
import { Paths } from "@/routes/Paths";

function formatFollowers(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

const MARQUEE_COPY =
  "15% of the global population buys scratchies every week. Regular spenders can spend between $20-50 a month. With Sugar Scratch you can earn from other influencers if you refer users";

export function LpBuildPage4() {
  const navigate = useNavigate();
  const fieldId = useId();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [followers, setFollowers] = useState("");
  const [focused, setFocused] = useState(false);
  const [percent, setPercent] = useState(11);
  const [period, setPeriod] = useState("Per Week");
  const floating = focused || followers.length > 0;

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
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setFromClientX(event.clientX);
  };

  return (
    <LpBuildShell>
      <div className="lp-build-page3-headline">
        How much money could you earn?
      </div>
      <div
        className={
          floating
            ? "lp-build-page4-field is-floating"
            : "lp-build-page4-field"
        }
      >
        <label htmlFor={fieldId}>Your Follower Count</label>
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
      <div className="lp-build-page4-convert-block">
      <div className="lp-build-page4-row">
        <span className="lp-build-page4-row-title">If you convert…</span>
        <CountUp
          className="lp-build-page4-row-followers"
          to={convertedCount}
          mode="roll"
          easing="easeOut"
          format="standard"
          separator=","
          trigger="load"
          duration={1.8}
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
          className="lp-build-page4-progress-handle"
          style={{ left: `${handleLeft}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
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
      <div className="lp-build-page4-marquee" aria-label={MARQUEE_COPY}>
        <div className="lp-build-page4-marquee-track">
          <span>{MARQUEE_COPY}</span>
          <span aria-hidden="true">{MARQUEE_COPY}</span>
        </div>
      </div>
      <div className="lp-build-page4-income-block">
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
            prefix={"$\u2006"}
            trigger="load"
            duration={1.8}
          />
        </p>
        <div className="lp-build-page4-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Join for FREE"
            costAmount={null}
            fontSize={14}
            onClick={() => navigate(Paths.lpBuildPage5)}
          />
        </div>
      </div>
    </LpBuildShell>
  );
}
