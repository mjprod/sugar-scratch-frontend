import { Images, Layers, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
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

function CollectionAvatarRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = AVATAR_RING_C - (clamped / 100) * AVATAR_RING_C;
  return (
    <span className="mc-model-avatar-ring" aria-hidden="true">
      <svg viewBox="0 0 80 80">
        <circle
          className="mc-model-avatar-ring-track"
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
          strokeDasharray={AVATAR_RING_C}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
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
        index == null
          ? undefined
          : ({ "--mc-i": index } as CSSProperties)
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
            <Sparkles size={12} strokeWidth={2.4} aria-hidden />
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
          <span
            className="mc-model-progress-fill"
            style={{ width: `${progress.pct}%` }}
          />
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
