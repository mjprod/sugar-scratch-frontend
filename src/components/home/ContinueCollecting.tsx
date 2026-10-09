import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
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
  /** Header mark — defaults to filled heart. */
  icon?: ReactNode;
  /** Accessible name for the section landmark. */
  ariaLabel?: string;
  /** When true, hides progress rings, percentage and fraction from cards. */
  hideProgress?: boolean;
  /** See-all control label (default SEE ALL). */
  seeAllLabel?: string;
  /** Extra class on the section root (e.g. home-v2 title casing). */
  className?: string;
  /** Avatar + progress only — hide name / % / fraction under the ring. */
  avatarOnly?: boolean;
};

function progressColor(percent: number): string {
  if (percent >= 60) return "oklch(0.669 0.23 6.08)";
  if (percent >= 45) return "oklch(0.652 0.187 351.84)";
  if (percent >= 35) return "oklch(0.806 0.136 84.74)";
  if (percent >= 20) return "oklch(0.71 0.139 59.4)";
  return "oklch(0.633 0 0)";
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
  icon,
  ariaLabel,
  hideProgress = false,
  seeAllLabel = "SEE ALL",
  className,
  avatarOnly = false,
}: ContinueCollectingSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(max - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [items, updateScrollState]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".continue-collecting-card");
    const styles = window.getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 20;
    const cardWidth = card?.offsetWidth ?? 120;
    const step = cardWidth + gap;
    const visible = Math.max(1, Math.floor((el.clientWidth + gap) / step));
    const page = Math.max(1, visible > 1 ? visible - 1 : 1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * page * step,
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  if (!items.length) return null;

  return (
    <section
      className={["continue-collecting", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? title.toLowerCase()}
    >
      <div className="continue-collecting-header">
        <div className="continue-collecting-title-row">
          {icon ?? (
            <Heart
              className="continue-collecting-heart"
              fill="currentColor"
              aria-hidden="true"
            />
          )}
          <h2 className="continue-collecting-title">{title}</h2>
        </div>
        {onSeeAllClick ? (
          <button
            type="button"
            className="continue-collecting-see-all"
            onClick={onSeeAllClick}
          >
            {seeAllLabel}
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="continue-collecting-scroll-wrap">
        <button
          type="button"
          className="continue-collecting-arrow is-prev glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
          aria-label="Previous creators"
          disabled={!canScrollLeft}
          onClick={() => scrollByPage(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <div className="continue-collecting-viewport">
          <div ref={scrollRef} className="continue-collecting-scroll">
            {items.map((item) => {
              const card = toCard(item);
              return (
                <CollectionCard
                  key={card.id}
                  card={card}
                  hideProgress={hideProgress}
                  avatarOnly={avatarOnly}
                  onClick={() => {
                    onCardClick?.(card.id);
                    onOpen?.(item);
                  }}
                />
              );
            })}
          </div>
          <div
            className={[
              "continue-collecting-fade is-left",
              canScrollLeft ? "is-visible" : "",
            ].join(" ")}
            aria-hidden="true"
          />
          <div
            className={[
              "continue-collecting-fade",
              canScrollRight ? "is-visible" : "",
            ].join(" ")}
            aria-hidden="true"
          />
        </div>

        <button
          type="button"
          className="continue-collecting-arrow is-next glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
          aria-label="Next creators"
          disabled={!canScrollRight}
          onClick={() => scrollByPage(1)}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
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
  hideProgress = false,
  avatarOnly = false,
}: {
  card: CollectionCardData;
  onClick: () => void;
  hideProgress?: boolean;
  avatarOnly?: boolean;
}) {
  const percent = Math.round(
    (card.progressCurrent / Math.max(1, card.progressTotal)) * 100,
  );
  const color = progressColor(percent);
  const showRank = !avatarOnly && card.rank != null && !card.isNew;
  // Just Drop In / unread: always show NEW when flagged (even at 0%).
  const showNew = !avatarOnly && Boolean(card.isNew);
  const showMeta = !avatarOnly;

  return (
    <button
      type="button"
      className={[
        "continue-collecting-card",
        avatarOnly ? "is-avatar-only" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      aria-label={
        hideProgress || avatarOnly
          ? `${card.creatorName}${
              avatarOnly && !hideProgress
                ? `, ${percent}% collected`
                : ""
            }`
          : `${card.creatorName}, ${percent}% collected, ${card.progressCurrent} of ${card.progressTotal}`
      }
    >
      <div className="continue-collecting-avatar-wrap">
        <ProgressRing percent={hideProgress ? 0 : percent} color={color}>
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

      {showMeta && !hideProgress ? (
        <span
          className="continue-collecting-dot"
          style={{ background: color }}
          aria-hidden="true"
        />
      ) : null}

      {showMeta ? (
        <div className="continue-collecting-meta">
          <span className="continue-collecting-name">{card.creatorName}</span>
          {!hideProgress ? (
            <span
              className="continue-collecting-pct"
              style={{
                color:
                  percent >= 60
                    ? "oklch(0.669 0.23 6.08)"
                    : "oklch(1 0 0 / 0.92)",
              }}
            >
              {percent}%
            </span>
          ) : null}
        </div>
      ) : null}
      {showMeta && !hideProgress ? (
        <p className="continue-collecting-fraction">
          {card.progressCurrent} / {card.progressTotal}
        </p>
      ) : null}
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
          stroke="oklch(1 0 0 / 0.08)"
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
