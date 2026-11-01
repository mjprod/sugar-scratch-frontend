import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./MotionCard.css";

export type StaticCardMeterProps = {
  /** First tick: champagne when the motion card is unlocked. */
  motionUnlocked?: boolean;
  /** Include the leading motion-unlock tick. Default true. */
  includeMotionTick?: boolean;
  /** Number of static cards tied to this motion card. Default 10. */
  staticTotal?: number;
  /** Indexes (0-based) of static cards played / unlocked / bought at least once. */
  collectedIndexes?: number[];
  className?: string;
};

const STATIC_LOCKED = "rgba(64,64,64,0.82)";

function paintedOpacity(el: Element) {
  let node: Element | null = el;
  let opacity = 1;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return 0;
    opacity *= Number(cs.opacity);
    node = node.parentElement;
  }
  return opacity;
}

/**
 * Figma 229:3123 — 11 ticks under a motion tile.
 * Tick 0 = motion unlock. The rest = associated static cards.
 */
export function StaticCardMeter({
  motionUnlocked = false,
  includeMotionTick = true,
  staticTotal = 10,
  collectedIndexes = [],
  className,
}: StaticCardMeterProps) {
  const collected = new Set(collectedIndexes);
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || inView) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setInView(true);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const deadline = performance.now() + 1200;
    const light = () => {
      if (cancelled) return;
      setInView(true);
    };
    // Overlay fade starts at opacity 0 — wait until the meter is actually
    // painted so the stagger isn't spent during the sheet rise.
    const waitPainted = () => {
      if (cancelled) return;
      if (paintedOpacity(el) >= 0.6 || performance.now() >= deadline) {
        light();
        return;
      }
      raf = requestAnimationFrame(waitPainted);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        waitPainted();
      },
      // Keep the fire line above the mobile dock so the stagger isn't spent off-screen.
      { rootMargin: "0px 0px -88px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [inView]);

  return (
    <div
      ref={rootRef}
      className={[
        "scm-meter flex items-center justify-center gap-[2px]",
        inView ? "is-inview" : "",
        className ?? "h-[13px] w-[92px]",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {includeMotionTick ? (
        <span
          className={[
            "scm-tick h-full min-w-px flex-1 rounded-[2px]",
            motionUnlocked ? "scm-tick--motion" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            motionUnlocked
              ? ({ "--scm-i": 0 } as CSSProperties)
              : { background: STATIC_LOCKED }
          }
        />
      ) : null}
      {Array.from({ length: staticTotal }, (_, index) => (
        <span
          key={index}
          className={[
            "scm-tick h-full min-w-px flex-1 rounded-[2px]",
            collected.has(index) ? "scm-tick--collected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            collected.has(index)
              ? ({
                  "--scm-i": includeMotionTick ? index + 1 : index,
                } as CSSProperties)
              : { background: STATIC_LOCKED }
          }
        />
      ))}
    </div>
  );
}
