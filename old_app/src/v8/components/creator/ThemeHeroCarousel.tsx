import { useEffect, useRef } from "react";
import type { ThemeCardData } from "../../flow/collection";

export function ThemeHeroCarousel({
  themes,
  activeIndex,
  onActiveIndexChange,
  onActivateFocused,
}: {
  themes: ThemeCardData[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onActivateFocused: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.children[activeIndex] as HTMLElement | undefined;
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    Array.from(el.children).forEach((child, index) => {
      const node = child as HTMLElement;
      const mid = node.offsetLeft + node.offsetWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    if (best !== activeIndex) onActiveIndexChange(best);
  }

  return (
    <div className="cpv2-carousel">
      <div
        ref={scrollerRef}
        className="cpv2-carousel-track"
        onScroll={onScroll}
      >
        {themes.map((theme, index) => {
          const focused = index === activeIndex;
          return (
            <button
              key={theme.id}
              type="button"
              className={["cpv2-hero-card", focused ? "is-focused" : "is-adjacent"].join(" ")}
              onClick={() => {
                if (focused) onActivateFocused();
                else onActiveIndexChange(index);
              }}
            >
              <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
              <div className="cpv2-hero-shade" />
              <div className="cpv2-hero-copy">
                <p className="cpv2-hero-name">{theme.name}</p>
                <p className="cpv2-hero-count">
                  {theme.collected} / {theme.total}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="cpv2-carousel-dots" aria-hidden="true">
        {themes.map((theme, index) => (
          <span
            key={theme.id}
            className={["cpv2-dot", index === activeIndex ? "is-active" : ""].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
