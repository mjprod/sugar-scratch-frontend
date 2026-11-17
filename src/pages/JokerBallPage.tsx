import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CtaButton } from "@/components/cta";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import { JokerBall3D } from "@/pages/JokerBall3D";
import {
  JOKER_COUNT,
  JOKER_MAX,
  JOKER_MIN,
  type JokerBallHandle,
  customNumberIndex,
} from "@/pages/jokerBall";
import "./joker-ball.css";

const CHEVRON_GLASS =
  "joker-ball-chevron glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface";

/** Magic-8-ball sandbox: Three.js spin + 1–38 controls. */
export function JokerBallPage() {
  const [index, setIndex] = useState(
    () => Math.floor(Math.random() * JOKER_COUNT),
  );
  const [custom, setCustom] = useState("");
  const [diceIn, setDiceIn] = useState(false);
  const [chevronsIn, setChevronsIn] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const ballRef = useRef<JokerBallHandle>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const holdRef = useRef<{
    delay: number;
    interval: number;
  } | null>(null);
  useMarkPageReady(true);

  useEffect(() => {
    if (!diceIn) {
      setChevronsIn(false);
      return;
    }
    const timer = window.setTimeout(() => setChevronsIn(true), 250);
    return () => window.clearTimeout(timer);
  }, [diceIn]);

  useEffect(() => () => stopHold(), []);

  function glideTo(next: number) {
    ballRef.current?.glideTo(next);
  }

  function stopHold() {
    const hold = holdRef.current;
    if (!hold) return;
    window.clearTimeout(hold.delay);
    window.clearInterval(hold.interval);
    holdRef.current = null;
  }

  function stepBy(dir: -1 | 1) {
    const next = Math.max(0, Math.min(JOKER_COUNT - 1, indexRef.current + dir));
    if (next === indexRef.current) {
      stopHold();
      return;
    }
    indexRef.current = next;
    glideTo(next);
  }

  function startHold(dir: -1 | 1) {
    stopHold();
    stepBy(dir);
    const delay = window.setTimeout(() => {
      const interval = window.setInterval(() => stepBy(dir), 85);
      if (holdRef.current) holdRef.current.interval = interval;
    }, 280);
    holdRef.current = { delay, interval: 0 };
  }

  function onChevronPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    dir: -1 | 1,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Already released / synthetic.
    }
    startHold(dir);
  }

  function applyCustom(raw: string) {
    const next = customNumberIndex(raw);
    if (next == null) return false;
    glideTo(next);
    return true;
  }

  function onCustomSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applyCustom(custom)) return;
    setPlaceOpen(true);
  }

  function onRandom() {
    let next = Math.floor(Math.random() * JOKER_COUNT);
    if (next === index && JOKER_COUNT > 1) {
      next = (next + 1) % JOKER_COUNT;
    }
    glideTo(next);
  }

  return (
    <main className="joker-ball-page">
      <div className="joker-ball-stage">
        <div className="joker-ball-hero">
          <JokerBall3D
            ref={ballRef}
            initialIndex={index}
            onIndexChange={setIndex}
            onSwipeHintPeak={() => setDiceIn(true)}
          />
          <button
            type="button"
            className={`${CHEVRON_GLASS} is-left${chevronsIn ? " is-in" : ""}`}
            aria-label="Previous number"
            aria-hidden={!chevronsIn}
            tabIndex={chevronsIn ? 0 : -1}
            disabled={!chevronsIn || index <= 0}
            onPointerDown={(event) => onChevronPointerDown(event, -1)}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onContextMenu={(event) => event.preventDefault()}
          >
            <ChevronLeft className="joker-ball-chevron__icon" aria-hidden />
          </button>
          <button
            type="button"
            className={`${CHEVRON_GLASS} is-right${chevronsIn ? " is-in" : ""}`}
            aria-label="Next number"
            aria-hidden={!chevronsIn}
            tabIndex={chevronsIn ? 0 : -1}
            disabled={!chevronsIn || index >= JOKER_COUNT - 1}
            onPointerDown={(event) => onChevronPointerDown(event, 1)}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onContextMenu={(event) => event.preventDefault()}
          >
            <ChevronRight className="joker-ball-chevron__icon" aria-hidden />
          </button>
          <button
            type="button"
            className={
              diceIn ? "joker-ball-random is-in" : "joker-ball-random"
            }
            aria-label="Random number"
            aria-hidden={!diceIn}
            tabIndex={diceIn ? 0 : -1}
            disabled={!diceIn}
            onClick={onRandom}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 512 512"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M465.023 135.32L376.68 465.023L46.977 376.68L135.32 46.977zM317.08 316.538c-17.071-4.574-34.618 5.557-39.192 22.627c-4.574 17.071 5.556 34.618 22.627 39.192s34.618-5.556 39.192-22.627s-5.557-34.618-22.627-39.192m-52.798-91.448c-17.07-4.574-34.617 5.557-39.192 22.628c-4.574 17.07 5.557 34.618 22.628 39.192s34.617-5.557 39.192-22.628c4.574-17.07-5.557-34.617-22.628-39.192m-52.797-91.447c-17.071-4.574-34.618 5.556-39.192 22.627s5.557 34.618 22.627 39.192c17.071 4.574 34.618-5.556 39.192-22.627s-5.556-34.618-22.627-39.192"
              />
            </svg>
          </button>
        </div>

        <form className="joker-ball-custom" onSubmit={onCustomSubmit}>
          <label className="joker-ball-custom__label" htmlFor="joker-ball-custom">
            custom number
          </label>
          <input
            id="joker-ball-custom"
            className="joker-ball-custom__input"
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min={JOKER_MIN}
            max={JOKER_MAX}
            step={1}
            value={custom}
            placeholder={`${JOKER_MIN}–${JOKER_MAX}`}
            onChange={(event) => setCustom(event.target.value)}
            onBlur={() => applyCustom(custom)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              applyCustom(custom);
              event.currentTarget.blur();
            }}
          />
          <div className="joker-ball-custom__cta">
            <CtaButton
              forceCss
              cssTone="gold"
              fillParent
              type="submit"
              label="Place in slots"
              costAmount={null}
              cornerRadius={16}
              strokeWidth={1}
            />
          </div>
        </form>
      </div>

      {placeOpen ? (
        <div
          className="joker-ball-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="joker-ball-popup-title"
        >
          <button
            type="button"
            className="joker-ball-popup__backdrop"
            aria-label="Close"
            onClick={() => setPlaceOpen(false)}
          />
          <div className="joker-ball-popup__card">
            <p id="joker-ball-popup-title" className="joker-ball-popup__copy">
              Will scroll to next section
            </p>
            <button
              type="button"
              className="joker-ball-popup__ok"
              onClick={() => setPlaceOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default JokerBallPage;
