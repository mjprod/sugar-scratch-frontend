import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ContinueCollectingItem } from "@/services/homepage";

export type ExploreCreatorItem = {
  creatorId: string;
  creatorName: string;
  avatarUrl: string;
  subtitle?: string;
  isNew?: boolean;
};

function toExploreItem(item: ContinueCollectingItem): ExploreCreatorItem {
  return {
    creatorId: item.creatorId,
    creatorName: item.creatorName,
    avatarUrl: item.avatarUrl,
    isNew: item.isNew ?? item.badge === "NEW",
    subtitle: item.isNew || item.badge === "NEW" ? "Joined recently" : undefined,
  };
}

/**
 * Homepage Explore Creators — Figma home strip in a Continue Collecting-style card.
 */
export function ExploreCreators({
  items,
  onOpen,
  onSeeAllClick,
}: {
  items: ContinueCollectingItem[];
  onOpen?: (item: ContinueCollectingItem) => void;
  onSeeAllClick?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const cards = items.map(toExploreItem);

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

  const holdDir = useRef<0 | -1 | 1>(0);
  const holdT0 = useRef(0);
  const holdLast = useRef(0);
  const holdRaf = useRef(0);
  const holdShift = useRef(0);

  const cardStep = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 77;
    const card = el.querySelector<HTMLElement>(
      ".explore-creators-card:not(.is-shim)",
    );
    const track = trackRef.current;
    const gapSource = track ?? el;
    const gap =
      Number.parseFloat(
        window.getComputedStyle(gapSource).columnGap ||
          window.getComputedStyle(gapSource).gap,
      ) || 8;
    return (card?.offsetWidth ?? 77) + gap;
  }, []);

  const paintShift = useCallback((shift: number) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return 0;
    const max = el.scrollWidth - el.clientWidth;
    const next = Math.max(0, Math.min(max, el.scrollLeft + shift));
    const applied = next - el.scrollLeft;
    holdShift.current = applied;
    track.style.transform = applied
      ? `translate3d(${-applied}px,0,0)`
      : "";
    setCanScrollLeft(next > 4);
    setCanScrollRight(max - next > 4);
    return applied;
  }, []);

  const scrollByCard = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.style.scrollBehavior = "auto";
    el.scrollBy({ left: direction * cardStep(), behavior: "auto" });
    el.style.scrollBehavior = "";
  }, [cardStep]);

  const stopHold = useCallback(() => {
    if (holdRaf.current) cancelAnimationFrame(holdRaf.current);
    holdRaf.current = 0;
    holdDir.current = 0;
    const el = scrollRef.current;
    const track = trackRef.current;
    const shift = holdShift.current;
    holdShift.current = 0;
    if (track) track.style.transform = "";
    if (el && shift) {
      el.style.scrollBehavior = "auto";
      el.scrollLeft += shift;
      el.style.scrollBehavior = "";
    }
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  const bindHold = (direction: -1 | 1) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || event.currentTarget.disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      stopHold();
      holdDir.current = direction;
      holdT0.current = performance.now();
      holdLast.current = holdT0.current;
      paintShift(direction * cardStep());
      const pump = (now: number) => {
        const el = scrollRef.current;
        const dir = holdDir.current;
        if (!el || !dir) return;
        const dt = Math.min(0.05, (now - holdLast.current) / 1000);
        holdLast.current = now;
        const t = Math.max(0, (now - holdT0.current) / 1000 - 0.07);
        if (t > 0) {
          const speed = Math.min(14000, 600 + 18000 * t * t);
          const applied = paintShift(holdShift.current + dir * speed * dt);
          const max = el.scrollWidth - el.clientWidth;
          const visual = el.scrollLeft + applied;
          if ((dir < 0 && visual <= 0) || (dir > 0 && visual >= max - 1)) {
            stopHold();
            return;
          }
        }
        holdRaf.current = requestAnimationFrame(pump);
      };
      holdRaf.current = requestAnimationFrame(pump);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      stopHold();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
      stopHold();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail !== 0) {
        event.preventDefault();
        return;
      }
      scrollByCard(direction);
    },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
  });

  const holdPrev = bindHold(-1);
  const holdNext = bindHold(1);

  if (!items.length) return null;

  return (
    <section
      className="continue-collecting explore-creators is-title-sentence"
      aria-label="Explore creators"
    >
      <div className="continue-collecting-header explore-creators-header">
        <div className="continue-collecting-title-row explore-creators-title-row">
          <Heart
            className="continue-collecting-heart explore-creators-heart"
            fill="currentColor"
            aria-hidden="true"
          />
          <h2 className="continue-collecting-title explore-creators-title">
            Explore Creators
          </h2>
        </div>
        {onSeeAllClick ? (
          <button
            type="button"
            className="continue-collecting-see-all explore-creators-see-all"
            onClick={onSeeAllClick}
          >
            Search
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="continue-collecting-scroll-wrap explore-creators-scroll-wrap">
        <button
          type="button"
          className="explore-creators-arrow is-prev glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
          aria-label="Previous creators"
          disabled={!canScrollLeft}
          {...holdPrev}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <div
          className={[
            "continue-collecting-viewport explore-creators-viewport",
            canScrollLeft ? "has-fade-left" : "",
            canScrollRight ? "has-fade-right" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            ref={scrollRef}
            className="continue-collecting-scroll explore-creators-scroll"
          >
            <div ref={trackRef} className="explore-creators-track">
            {/* Invisible left spacer matching a card’s width (Figma left inset). */}
            <div
              className="explore-creators-card is-shim"
              aria-hidden="true"
            >
              <span className="explore-creators-avatar-wrap">
                <span className="explore-creators-avatar is-fallback" />
              </span>
              <span className="explore-creators-name">&nbsp;</span>
              <span className="explore-creators-sub">&nbsp;</span>
            </div>
            {cards.map((card, index) => {
              const source = items[index];
              return (
                <button
                  key={card.creatorId}
                  type="button"
                  className="explore-creators-card"
                  onClick={() => source && onOpen?.(source)}
                >
                  <span className="explore-creators-avatar-wrap">
                    {card.avatarUrl ? (
                      <img
                        src={card.avatarUrl}
                        alt=""
                        className="explore-creators-avatar"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="explore-creators-avatar is-fallback" />
                    )}
                  </span>
                  <span className="explore-creators-name">{card.creatorName}</span>
                  {card.subtitle ? (
                    <span className="explore-creators-sub">
                      <span className="explore-creators-sub-full">
                        {card.subtitle}
                      </span>
                      <span className="explore-creators-sub-short">New</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
            {/* Matching right spacer so end inset equals the left shim. */}
            <div
              className="explore-creators-card is-shim is-shim-end"
              aria-hidden="true"
            >
              <span className="explore-creators-avatar-wrap">
                <span className="explore-creators-avatar is-fallback" />
              </span>
              <span className="explore-creators-name">&nbsp;</span>
              <span className="explore-creators-sub">&nbsp;</span>
            </div>
            </div>
          </div>
          <div
            className={[
              "continue-collecting-fade explore-creators-fade is-left",
              canScrollLeft ? "is-visible" : "",
            ].join(" ")}
            aria-hidden="true"
          />
          <div
            className={[
              "continue-collecting-fade explore-creators-fade",
              canScrollRight ? "is-visible" : "",
            ].join(" ")}
            aria-hidden="true"
          />
        </div>

        <button
          type="button"
          className="explore-creators-arrow is-next glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface"
          aria-label="Next creators"
          disabled={!canScrollRight}
          {...holdNext}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
