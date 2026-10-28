import { useId, type CSSProperties } from "react";
import "./CollectionAvatarRing.css";

const AVATAR_RING_R = 34;
const AVATAR_RING_C = 2 * Math.PI * AVATAR_RING_R;

export function CollectionAvatarRing({
  percent,
  index,
}: {
  percent: number;
  /** Load-in stagger index (collect rows). */
  index?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const coreId = `mc-ring-${uid}`;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = AVATAR_RING_C * (1 - clamped / 100);
  return (
    <span
      className="mc-model-avatar-ring"
      aria-hidden="true"
      style={
        {
          "--mc-ring-c": AVATAR_RING_C,
          "--mc-ring-offset": offset,
          ...(index == null ? {} : { "--mc-i": index }),
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 80 80">
        <circle
          className="mc-model-avatar-ring-track"
          cx="40"
          cy="40"
          r={AVATAR_RING_R}
          fill="none"
        />
      </svg>
      <svg className="mc-model-avatar-ring-progress" viewBox="0 0 80 80">
        <defs>
          <linearGradient
            id={coreId}
            x1="40"
            y1="6"
            x2="40"
            y2="74"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="oklch(0.75 0.21 54)" />
            <stop offset="22%" stopColor="oklch(0.69 0.32 348.63)" />
            <stop offset="50%" stopColor="oklch(0.68 0.31 355.85)" />
            <stop offset="78%" stopColor="oklch(0.71 0.27 355.85)" />
            <stop offset="100%" stopColor="oklch(0.75 0.21 54.14)" />
          </linearGradient>
        </defs>
        <g transform="rotate(-90 40 40)">
          <circle
            className="mc-model-avatar-ring-glow"
            cx="40"
            cy="40"
            r={AVATAR_RING_R}
            fill="none"
          />
          <circle
            className="mc-model-avatar-ring-arc"
            cx="40"
            cy="40"
            r={AVATAR_RING_R}
            fill="none"
          />
          <circle
            className="mc-model-avatar-ring-core"
            cx="40"
            cy="40"
            r={AVATAR_RING_R}
            fill="none"
            stroke={`url(#${coreId})`}
          />
        </g>
      </svg>
    </span>
  );
}
