import { motion, type PanInfo } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { type FeaturedPack } from "@/services/homepage";
import { PhysicalPackCard } from "./PhysicalPackCard";

/**
 * Featured Pack Carousel — premium physical pack hero (Spec 1.0).
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
  const rootRef = useRef<HTMLElement>(null);

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(packs.length - 1, i + delta)));
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -64) go(1);
    else if (info.offset.x > 64) go(-1);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const root = rootRef.current;
      if (!root) return;
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
  }, [packs.length]);

  if (!packs.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <p className="text-[18px] font-semibold">No featured packs</p>
      </div>
    );
  }

  return (
    <section
      ref={rootRef}
      className="featured-pack-carousel"
      aria-label="Featured pack carousel"
      aria-roledescription="carousel"
      tabIndex={0}
    >
      <div className="featured-pack-viewport">
        <div className="featured-pack-track">
          {packs.map((p, i) => {
            const offset = i - index;
            const abs = Math.abs(offset);
            if (abs > 1) return null;
            const focused = offset === 0;
            return (
              <motion.div
                key={p.id}
                layout
                onClick={() => {
                  if (!focused) setIndex(i);
                }}
                animate={{
                  scale: focused ? 1 : 0.9,
                  opacity: focused ? 1 : 0.62,
                  y: focused ? 0 : 8,
                  filter: focused
                    ? "brightness(1) saturate(1)"
                    : "brightness(0.65) saturate(0.8)",
                }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className={[
                  "featured-pack-slide",
                  focused ? "is-active" : "is-preview",
                ].join(" ")}
                style={{
                  zIndex: focused ? 2 : 1,
                  order: offset < 0 ? 0 : offset > 0 ? 2 : 1,
                }}
                drag={focused ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.14}
                onDragEnd={focused ? onDragEnd : undefined}
                role={focused ? undefined : "button"}
                tabIndex={focused ? undefined : 0}
                aria-label={focused ? undefined : `Show ${p.packTitle.replace(/\n/g, " ")}`}
                onKeyDown={(event) => {
                  if (!focused && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    setIndex(i);
                  }
                }}
              >
                <PhysicalPackCard
                  pack={p}
                  active={focused}
                  onOpen={() => onPlay(p)}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="featured-pack-dots" role="tablist" aria-label="Featured packs">
        {packs.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${p.packTitle.replace(/\n/g, " ")} by ${p.creatorName}`}
            onClick={() => setIndex(i)}
            className={[
              "featured-pack-dot",
              i === index ? "is-active" : "",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  );
}
