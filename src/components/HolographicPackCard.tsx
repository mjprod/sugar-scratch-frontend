import { motion } from "framer-motion";
import { useState, type PointerEvent, type ReactNode } from "react";
import { isVideoSrc } from "@/services/models";

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
          ? "bg-[linear-gradient(135deg,oklch(0.926_0.081_95.37),oklch(0.542_0.103_85.83),oklch(0.962_0.077_98.92),oklch(0.394_0.075_84.08))]"
          : "bg-[linear-gradient(135deg,oklch(0.969_0.016_293.76),oklch(0.522_0.12_292.97),oklch(0.827_0.108_306.38),oklch(0.274_0.053_292.03),oklch(0.811_0.101_293.57))]",
        "shadow-[0_24px_70px_oklch(0_0_0_/_0.55)]",
      ].join(" ")}
      style={{
        transform: interactive
          ? `perspective(900px) rotateX(${(50 - light.y) / 14}deg) rotateY(${(light.x - 50) / 14}deg)`
          : undefined,
      }}
    >
      <div className="relative size-full overflow-hidden rounded-[21px] bg-[oklch(0.162_0.01_285.17)]">
        {isVideoSrc(src) ? (
          <video
            src={src}
            muted
            loop
            playsInline
            autoPlay
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : (
          <img src={src} alt={name} className="absolute inset-0 size-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/15" />
        <div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-color-dodge transition-opacity group-hover:opacity-65"
          style={{
            background: `radial-gradient(circle at ${light.x}% ${light.y}%, oklch(1 0 0 / 0.8), transparent 18%), conic-gradient(from 210deg at ${light.x}% ${light.y}%, oklch(0.606 0.219 292.72 / 0.18), oklch(0.656 0.212 354.31 / 0.2), oklch(0.773 0.153 163.22 / 0.12), oklch(0.767 0.139 91.06 / 0.18), oklch(0.606 0.219 292.72 / 0.18))`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(115deg,transparent_0,transparent_8px,oklch(1_0_0_/_0.18)_9px,transparent_10px)]" />
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
