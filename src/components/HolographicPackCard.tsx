import { motion } from "framer-motion";
import { useState, type PointerEvent, type ReactNode } from "react";

export function HolographicPackCard({
  src,
  name,
  badge,
  compact = false,
  interactive = true,
  children,
}: {
  src: string;
  name: string;
  badge?: string;
  compact?: boolean;
  interactive?: boolean;
  children?: ReactNode;
}) {
  const [light, setLight] = useState({ x: 50, y: 35 });

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setLight({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  }

  return (
    <motion.div
      onPointerMove={move}
      onPointerLeave={() => setLight({ x: 50, y: 35 })}
      whileHover={interactive ? { y: -6, scale: 1.02 } : undefined}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={[
        "group relative aspect-[3/4] overflow-hidden rounded-[24px] p-[3px]",
        compact ? "w-36 sm:w-44" : "w-[220px] sm:w-[260px] lg:w-[300px]",
        badge === "Limited"
          ? "bg-[linear-gradient(135deg,#f7e7a9,#8a6a16,#fff4b8,#59420a)]"
          : "bg-[linear-gradient(135deg,#f5f3ff,#6d5aa8,#d8b4fe,#28223f,#c4b5fd)]",
        "shadow-[0_24px_70px_rgba(0,0,0,.55)]",
      ].join(" ")}
      style={{
        transform: interactive
          ? `perspective(900px) rotateX(${(50 - light.y) / 14}deg) rotateY(${(light.x - 50) / 14}deg)`
          : undefined,
      }}
    >
      <div className="relative size-full overflow-hidden rounded-[21px] bg-[#0d0d12]">
        <img src={src} alt={name} className="absolute inset-0 size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/15" />
        <div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-color-dodge transition-opacity group-hover:opacity-65"
          style={{
            background: `radial-gradient(circle at ${light.x}% ${light.y}%, rgba(255,255,255,.8), transparent 18%), conic-gradient(from 210deg at ${light.x}% ${light.y}%, rgba(139,92,246,.18), rgba(236,72,153,.2), rgba(52,211,153,.12), rgba(212,175,55,.18), rgba(139,92,246,.18))`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(115deg,transparent_0,transparent_8px,rgba(255,255,255,.18)_9px,transparent_10px)]" />
        <motion.div
          className="pointer-events-none absolute -inset-y-12 w-1/3 -skew-x-12 bg-white/18 blur-xl"
          animate={{ x: ["-180%", "500%"] }}
          transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 2.5, ease: "easeOut" }}
        />
        {badge ? (
          <span className="absolute top-3 left-3 rounded-full border border-white/25 bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white uppercase backdrop-blur-md">
            {badge}
          </span>
        ) : null}
        {children ? (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-16 pb-4 text-left">
            {children}
          </div>
        ) : null}
        <div className="absolute inset-x-3 bottom-3 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      </div>
    </motion.div>
  );
}
