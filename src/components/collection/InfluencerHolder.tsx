import { Images, Layers } from "lucide-react";
import { useId, type CSSProperties } from "react";
import type { CollectionProgressCounts } from "@/services/creatorBoard";
import "@/components/collection/CollectionPage.css";

export type InfluencerHolderProps = {
  name: string;
  place?: string;
  avatarUrl: string;
  progress: CollectionProgressCounts;
  onClick?: () => void;
  /** 0-based list index — used for load-in stagger. */
  index?: number;
};

const AVATAR_RING_R = 34;
const AVATAR_RING_C = 2 * Math.PI * AVATAR_RING_R;

function UltraStarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="m8.85 16.825l3.15-1.9l3.15 1.925l-.825-3.6l2.775-2.4l-3.65-.325l-1.45-3.4l-1.45 3.375l-3.65.325l2.775 2.425zm3.15.45l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15zm7.25-11.45l-1.5.875q-.15.075-.288-.013t-.087-.262l.4-1.65l-1.325-1.1q-.125-.125-.075-.262t.225-.163l1.75-.15l.675-1.575q.05-.15.225-.15t.225.15L20.15 3.1l1.75.15q.175.025.225.163t-.075.262l-1.325 1.1l.4 1.65q.05.175-.087.263t-.288.012z"
      />
    </svg>
  );
}

function CollectionAvatarRing({ percent }: { percent: number }) {
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

/**
 * Collect-page influencer row: avatar ring, name, place, counts, progress.
 */
export function InfluencerHolder({
  name,
  place,
  avatarUrl,
  progress,
  onClick,
  index,
}: InfluencerHolderProps) {
  return (
    <button
      type="button"
      className="mc-model-card"
      role="listitem"
      style={
        {
          "--mc-progress": `${progress.pct}%`,
          ...(index == null ? {} : { "--mc-i": index }),
        } as CSSProperties
      }
      onClick={onClick}
      aria-label={`${name}, ${progress.owned} of ${progress.total} cards`}
    >
      <span className="mc-model-card-glow" aria-hidden="true">
        <span className="mc-model-card-glow-blob mc-model-card-glow-blob--a" />
        <span className="mc-model-card-glow-blob mc-model-card-glow-blob--b" />
      </span>
      <span className="mc-model-avatar-wrap">
        <CollectionAvatarRing percent={progress.pct} />
        <img
          src={avatarUrl}
          alt=""
          className="mc-model-avatar"
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="mc-model-body">
        <span className="mc-model-name">{name}</span>
        {place ? <span className="mc-model-place">{place}</span> : null}
        <span className="mc-model-metrics">
          <span className="mc-model-metric">
            <Images size={12} strokeWidth={2.4} aria-hidden />
            {progress.staticOwned}/{progress.staticTotal}
          </span>
          <span className="mc-model-metric">
            <Layers size={12} strokeWidth={2.4} aria-hidden />
            {progress.motionOwned}/{progress.motionTotal}
          </span>
          <span className="mc-model-metric">
            <UltraStarIcon />
            {progress.ultraOwned}/{progress.ultraTotal}
          </span>
        </span>
        <span
          className="mc-model-progress"
          role="progressbar"
          aria-valuenow={progress.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress.owned} of ${progress.total}`}
        >
          <span className="mc-model-progress-fill" />
        </span>
      </span>
    </button>
  );
}

function Bone({ className }: { className?: string }) {
  return (
    <span
      className={["mc-model-bone", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}

/** Shape-matched placeholder for InfluencerHolder. */
export function InfluencerHolderSkeleton() {
  return (
    <div className="mc-model-card" aria-busy="true">
      <span className="mc-model-avatar-wrap">
        <CollectionAvatarRing percent={0} />
        <Bone className="mc-model-avatar" />
      </span>
      <span className="mc-model-body">
        <Bone className="is-name" />
        <Bone className="is-place" />
        <span className="mc-model-metrics">
          <span className="mc-model-metric">
            <Bone className="is-metric-icon" />
            <Bone className="is-metric" />
          </span>
          <span className="mc-model-metric">
            <Bone className="is-metric-icon" />
            <Bone className="is-metric" />
          </span>
          <span className="mc-model-metric">
            <Bone className="is-metric-icon" />
            <Bone className="is-metric" />
          </span>
        </span>
        <span className="mc-model-progress" aria-hidden="true" />
      </span>
    </div>
  );
}
