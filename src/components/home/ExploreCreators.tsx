import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".explore-creators-card");
    const styles = window.getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 8;
    const cardWidth = card?.offsetWidth ?? 77;
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
            See All
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
          onClick={() => scrollByPage(-1)}
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
                    <span className="explore-creators-sub">{card.subtitle}</span>
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
          onClick={() => scrollByPage(1)}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
