import { Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import {
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/services/homepage";
import { PackArt } from "./PackArt";

/** Figma filter chips (node 9:758) — emoji + label. */
const FIGMA_TAB_EMOJI: Partial<Record<LeaderboardCategory, string>> = {
  police: "🚨",
  teacher: "✏️",
  nurse: "💉",
  gym: "🎧",
  firefighter: "🔥",
};

/** Figma crowns: gold 9:265, silver 9:311, bronze 9:314. */
const RANK_CROWN_SRC: Record<1 | 2 | 3, string> = {
  1: "/images/home-v2/rank-crown-gold.svg",
  2: "/images/home-v2/rank-crown-silver.svg",
  3: "/images/home-v2/rank-crown-bronze.svg",
};

export function CategoryLeaderboard({
  category,
  rows,
  loading,
  onCategoryChange,
  onPlay,
  onOpen,
  title = "Top packs by purchase",
  className,
}: {
  category: LeaderboardCategory;
  rows: LeaderboardRow[];
  loading?: boolean;
  onCategoryChange: (c: LeaderboardCategory) => void;
  onPlay: (row: LeaderboardRow) => void;
  onOpen: (row: LeaderboardRow) => void;
  title?: string;
  className?: string;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateTabsScrollState = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(max - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    updateTabsScrollState();
    el.addEventListener("scroll", updateTabsScrollState, { passive: true });
    const ro = new ResizeObserver(updateTabsScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateTabsScrollState);
      ro.disconnect();
    };
  }, [category, updateTabsScrollState]);

  return (
    <section
      className={[
        "continue-collecting category-leaderboard",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Category leaderboard"
    >
      <div className="continue-collecting-header">
        <div className="continue-collecting-title-row">
          <Trophy
            className="continue-collecting-heart"
            aria-hidden="true"
          />
          <h2 className="continue-collecting-title">{title}</h2>
        </div>
      </div>

      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Leaderboard categories"
        className={[
          "category-leaderboard-tabs",
          canScrollLeft ? "has-fade-left" : "",
          canScrollRight ? "has-fade-right" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Invisible chip spacer — same size as a real tab, not interactive. */}
        <span
          className="category-leaderboard-tab is-shim"
          aria-hidden="true"
        >
          All
        </span>
        {LEADERBOARD_CATEGORIES.map((c) => {
          const active = c.id === category;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onCategoryChange(c.id)}
              className={[
                "category-leaderboard-tab",
                active ? "is-active" : "",
              ].join(" ")}
            >
              {FIGMA_TAB_EMOJI[c.id]
                ? `${FIGMA_TAB_EMOJI[c.id]} ${c.label}`
                : c.label}
            </button>
          );
        })}
      </div>

      <div
        className={[
          "category-leaderboard-list",
          loading ? "is-loading" : "",
        ].join(" ")}
      >
        {!rows.length ? (
          <p className="category-leaderboard-empty">No featured packs available.</p>
        ) : (
          rows.slice(0, 6).map((row) => (
            <div
              key={`${row.category}-${row.packId}-${row.rank}`}
              className={[
                "category-leaderboard-row",
                row.rank === 1 ? "is-first-place" : "",
                row.rank === 2 ? "is-second-place" : "",
                row.rank === 3 ? "is-third-place" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={[
                  "category-leaderboard-rank",
                  row.rank === 1 ? "is-first" : "",
                  row.rank === 2 ? "is-second" : "",
                  row.rank === 3 ? "is-third" : "",
                  row.rank > 3 ? "is-empty" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={row.rank <= 3 ? `Rank ${row.rank}` : undefined}
                aria-hidden={row.rank > 3 ? true : undefined}
              >
                {row.rank === 1 || row.rank === 2 || row.rank === 3 ? (
                  <img
                    src={RANK_CROWN_SRC[row.rank]}
                    alt=""
                    className="category-leaderboard-rank-crown"
                    width={29}
                    height={29}
                    draggable={false}
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="category-leaderboard-thumb"
                aria-label={`Open ${row.packName}`}
              >
                <PackArt
                  src={row.thumbnailUrl}
                  alt=""
                  size="thumb"
                  className="!w-10 !rounded-[1.6rem]"
                />
              </button>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="category-leaderboard-info"
              >
                {/* Figma 9:60 — 1 col / 3 rows: pack, author, buys */}
                <p className="category-leaderboard-pack">
                  Pack Nº {row.packName}
                </p>
                <p className="category-leaderboard-author">{row.creatorName}</p>
                <p className="category-leaderboard-stats">
                  🔥 {row.purchaseCount.toLocaleString()} Buys
                </p>
              </button>
              <div className="category-leaderboard-actions">
                <div className="category-leaderboard-play">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    label={`${row.diamondCost} Play`}
                    leadingIcon={
                      <DiamondLottie
                        className="category-leaderboard-play-diamond"
                        size={14}
                        aria-hidden
                      />
                    }
                    costAmount={null}
                    fontSize={12}
                    cornerRadius={999}
                    aria-label={`Play ${row.packName} for ${row.diamondCost} diamonds`}
                    onClick={() => onPlay(row)}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
