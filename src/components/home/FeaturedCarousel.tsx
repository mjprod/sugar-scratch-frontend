import { motion, type PanInfo, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FeaturedPack } from "@/services/homepage";
import { PhysicalPackCard } from "./PhysicalPackCard";

const HINT_KEY = "sugar.v8.featuredCarouselSwipeHint";
const TRANSITION = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };

function circularOffset(i: number, active: number, n: number): number {
  if (n <= 1) return 0;
  let d = i - active;
  d = ((d % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

function hasSeenSwipeHint() {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}

function markSwipeHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Featured Pack Carousel — premium physical pack hero (Spec 1.0)
 * + seamless infinite loop when 2+ packs.
 */
export function FeaturedCarousel({
  packs,
  onPlay,
}: {
  packs: FeaturedPack[];
  onPlay: (pack: FeaturedPack) => void;
  onOpenDetail?: (pack: FeaturedPack) => void;
}) {
  const [index, setIndex] = useState(0);
  const [nudgeX, setNudgeX] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const interactingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const count = packs.length;
  const canLoop = count > 1;
  const active = count ? packs[index % count] : null;

  const go = useCallback(
    (delta: number) => {
      if (!canLoop) return;
      setIndex((i) => (i + delta + count * 8) % count);
    },
    [canLoop, count],
  );

  const goTo = useCallback(
    (target: number) => {
      if (!count) return;
      setIndex(((target % count) + count) % count);
    },
    [count],
  );

  function onDragEnd(_: unknown, info: PanInfo) {
    if (!canLoop) return;
    const vx = info.velocity.x;
    const ox = info.offset.x;
    if (ox < -64 || vx < -500) go(1);
    else if (ox > 64 || vx > 500) go(-1);
  }

  useEffect(() => {
    if (!count) {
      setIndex(0);
      return;
    }
    setIndex((i) => i % count);
  }, [count]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const root = rootRef.current;
      if (!root || !canLoop) return;
      const activeEl = document.activeElement;
      if (activeEl !== root && !root.contains(activeEl)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canLoop, go]);

  /* One-time swipe affordance nudge (spec §§17–19). */
  useEffect(() => {
    if (!canLoop || reduceMotion || hasSeenSwipeHint()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || interactingRef.current) return;
      setNudgeX(-8);
      window.setTimeout(() => {
        if (cancelled) return;
        setNudgeX(0);
        markSwipeHintSeen();
      }, 420);
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canLoop, reduceMotion]);

  if (!packs.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <p className="text-[18px] font-semibold">No featured packs</p>
      </div>
    );
  }

  const slides = packs
    .map((p, i) => {
      const offset = circularOffset(i, index, count);
      const abs = Math.abs(offset);
      /* Two packs: only peek the next card so the same pack never appears twice. */
      if (count === 2 && offset < 0) return null;
      if (abs > 1) return null;
      return { pack: p, i, offset, focused: offset === 0 };
    })
    .filter(Boolean) as {
    pack: FeaturedPack;
    i: number;
    offset: number;
    focused: boolean;
  }[];

  const transition = reduceMotion
    ? { duration: 0.01 }
    : TRANSITION;

  return (
    <section
      ref={rootRef}
      className="featured-pack-carousel"
      aria-label="Featured pack carousel"
      aria-roledescription="carousel"
      tabIndex={0}
      onPointerDown={() => {
        interactingRef.current = true;
      }}
      onPointerEnter={() => {
        interactingRef.current = true;
      }}
    >
      {canLoop ? (
        <button
          type="button"
          className="featured-pack-arrow is-prev"
          aria-label="Previous featured pack"
          onClick={() => go(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : null}

      <div className="featured-pack-viewport">
        <motion.div
          className="featured-pack-track"
          animate={{ x: nudgeX }}
          transition={transition}
        >
          {slides.map(({ pack: p, i, offset, focused }) => (
            <motion.div
              key={p.id}
              layout={!reduceMotion}
              onClick={() => {
                if (!focused) goTo(i);
              }}
              animate={{
                scale: focused ? 1 : 0.82,
                opacity: focused ? 1 : 0.62,
                y: focused ? 0 : 8,
              }}
              transition={transition}
              className={[
                "featured-pack-slide",
                focused ? "is-active" : "is-preview",
              ].join(" ")}
              style={{
                zIndex: focused ? 2 : 1,
                order: offset < 0 ? 0 : offset > 0 ? 2 : 1,
              }}
              drag={focused && canLoop ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.14}
              dragDirectionLock
              onDragEnd={focused && canLoop ? onDragEnd : undefined}
            >
              <PhysicalPackCard
                pack={p}
                active={focused}
                onOpen={() => onPlay(p)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {canLoop ? (
        <button
          type="button"
          className="featured-pack-arrow is-next"
          aria-label="Next featured pack"
          onClick={() => go(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}

      {canLoop ? (
        <div
          className="featured-pack-dots"
          role="tablist"
          aria-label="Featured packs"
        >
          {packs.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${p.packTitle.replace(/\n/g, " ")} by ${p.creatorName}`}
              onClick={() => goTo(i)}
              className={[
                "featured-pack-dot",
                i === index ? "is-active" : "",
              ].join(" ")}
            />
          ))}
        </div>
      ) : null}

      {active ? (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {`${active.packTitle.replace(/\n/g, " ")}, featured pack, ${index + 1} of ${count}`}
        </p>
      ) : null}
    </section>
  );
}
