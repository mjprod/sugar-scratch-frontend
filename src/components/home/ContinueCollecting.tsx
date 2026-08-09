import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Heart } from "lucide-react";
import type { ContinueCollectingItem } from "@/services/homepage";

export type CollectionCardData = {
  id: string;
  creatorName: string;
  avatarUrl: string;
  progressCurrent: number;
  progressTotal: number;
  rank?: number;
  isNew?: boolean;
};

export type ContinueCollectingSectionProps = {
  title?: string;
  items: ContinueCollectingItem[];
  onSeeAllClick?: () => void;
  onCardClick?: (id: string) => void;
  /** @deprecated use onCardClick */
  onOpen?: (item: ContinueCollectingItem) => void;
};

function progressColor(percent: number): string {
  if (percent >= 60) return "#FF3D7F";
  if (percent >= 45) return "#E0559C";
  if (percent >= 35) return "#E8B84B";
  if (percent >= 20) return "#E08A3C";
  return "#8A8A8A";
}

function toCard(item: ContinueCollectingItem): CollectionCardData {
  return {
    id: item.creatorId,
    creatorName: item.creatorName,
    avatarUrl: item.avatarUrl,
    progressCurrent: item.collected,
    progressTotal: item.total,
    rank: item.rank,
    isNew: item.isNew ?? item.badge === "NEW",
  };
}

/**
 * Homepage Continue Collecting — circular avatar strip with progress rings.
 */
export function ContinueCollectingSection({
  title = "CONTINUE COLLECTING",
  items,
  onSeeAllClick,
  onCardClick,
  onOpen,
}: ContinueCollectingSectionProps) {
  if (!items.length) return null;

  return (
    <section className="continue-collecting" aria-label="Continue collecting">
      <div className="continue-collecting-header">
        <div className="continue-collecting-title-row">
          <Heart
            className="continue-collecting-heart"
            fill="currentColor"
            aria-hidden="true"
          />
          <h2 className="continue-collecting-title">{title}</h2>
        </div>
        {onSeeAllClick ? (
          <button
            type="button"
            className="continue-collecting-see-all"
            onClick={onSeeAllClick}
          >
            SEE ALL
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="continue-collecting-scroll-wrap">
        <div className="continue-collecting-scroll">
          {items.map((item) => {
            const card = toCard(item);
            return (
              <CollectionCard
                key={card.id}
                card={card}
                onClick={() => {
                  onCardClick?.(card.id);
                  onOpen?.(item);
                }}
              />
            );
          })}
        </div>
        <div className="continue-collecting-fade" aria-hidden="true" />
        <div className="continue-collecting-more" aria-hidden="true">
          <ChevronRight className="size-5" />
        </div>
      </div>
    </section>
  );
}

/** Homepage alias */
export function ContinueCollecting(props: ContinueCollectingSectionProps) {
  return <ContinueCollectingSection {...props} />;
}

function CollectionCard({
  card,
  onClick,
}: {
  card: CollectionCardData;
  onClick: () => void;
}) {
  const percent = Math.round(
    (card.progressCurrent / Math.max(1, card.progressTotal)) * 100,
  );
  const color = progressColor(percent);
  const showRank = card.rank != null && !card.isNew;
  const showNew = Boolean(card.isNew) && card.rank == null;

  return (
    <button
      type="button"
      className="continue-collecting-card"
      onClick={onClick}
      aria-label={`${card.creatorName}, ${percent}% collected, ${card.progressCurrent} of ${card.progressTotal}`}
    >
      <div className="continue-collecting-avatar-wrap">
        <ProgressRing percent={percent} color={color}>
          <img
            src={card.avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="continue-collecting-avatar"
            style={{ objectFit: "cover", objectPosition: "center 20%" }}
          />
        </ProgressRing>
        {showRank ? (
          <span className="continue-collecting-rank">{card.rank}</span>
        ) : null}
        {showNew ? <span className="continue-collecting-new">NEW</span> : null}
      </div>

      <span
        className="continue-collecting-dot"
        style={{ background: color }}
        aria-hidden="true"
      />

      <div className="continue-collecting-meta">
        <span className="continue-collecting-name">{card.creatorName}</span>
        <span
          className="continue-collecting-pct"
          style={{ color: percent >= 60 ? "#FF3D7F" : "rgba(255,255,255,0.92)" }}
        >
          {percent}%
        </span>
      </div>
      <p className="continue-collecting-fraction">
        {card.progressCurrent} / {card.progressTotal}
      </p>
    </button>
  );
}

function ProgressRing({
  percent,
  color,
  children,
}: {
  percent: number;
  color: string;
  children: ReactNode;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const target = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  const [offset, setOffset] = useState(c);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOffset(target);
      return;
    }
    const id = window.requestAnimationFrame(() => setOffset(target));
    return () => window.cancelAnimationFrame(id);
  }, [target]);

  return (
    <span
      className="continue-collecting-ring"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <svg className="continue-collecting-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          className="continue-collecting-ring-arc"
        />
      </svg>
      {children}
    </span>
  );
}
