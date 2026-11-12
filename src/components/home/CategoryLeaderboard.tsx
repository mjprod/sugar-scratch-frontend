import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import {
  formatPurchaseCount,
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/services/homepage";
import { PackArt } from "./PackArt";
import "@/components/creator/mcp-photo-play-cta-css.css";

const MOBILE_CTA_QUERY = "(max-width: 980px)";

/** Figma crowns: gold 9:265, silver 9:311, bronze 9:314. */
const RANK_CROWN_SRC: Record<1 | 2 | 3, string> = {
  1: "/images/home-v2/rank-crown-gold.svg",
  2: "/images/home-v2/rank-crown-silver.svg",
  3: "/images/home-v2/rank-crown-bronze.svg",
};

const EMPTY_PACK_ART = "/images/packs/imageEmptyPack";

function RankEmptyPackArt() {
  return (
    <picture>
      <source
        type="image/jxl"
        srcSet={`${EMPTY_PACK_ART}@1x.jxl 1x, ${EMPTY_PACK_ART}@2x.jxl 2x`}
      />
      <source
        type="image/webp"
        srcSet={`${EMPTY_PACK_ART}@1x.webp 1x, ${EMPTY_PACK_ART}@2x.webp 2x`}
      />
      <img
        className="category-leaderboard-empty-art"
        src={`${EMPTY_PACK_ART}@1x.png`}
        srcSet={`${EMPTY_PACK_ART}@1x.png 1x, ${EMPTY_PACK_ART}@2x.png 2x`}
        alt=""
        width={355}
        height={532}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

export function CategoryLeaderboard({
  category,
  rows,
  loading,
  onCategoryChange,
  onPlay,
  onOpen,
  title = "Top packs by purchase",
  titleTag = "h2",
  className,
}: {
  category: LeaderboardCategory;
  rows: LeaderboardRow[];
  loading?: boolean;
  onCategoryChange: (c: LeaderboardCategory) => void;
  onPlay: (row: LeaderboardRow) => void;
  onOpen: (row: LeaderboardRow) => void;
  title?: string;
  titleTag?: "h1" | "h2";
  className?: string;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [cssPlayCta, setCssPlayCta] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_CTA_QUERY).matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_CTA_QUERY);
    const sync = () => setCssPlayCta(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

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

  const Title = titleTag;

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
          <Title className="continue-collecting-title">{title}</Title>
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
          Purchased
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
              {c.label}
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
          <div className="category-leaderboard-empty">
            <RankEmptyPackArt />
            <p className="category-leaderboard-empty-copy">
              No featured packs available.
            </p>
          </div>
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
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="category-leaderboard-thumb"
                aria-label={`Open ${row.creatorName}`}
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
                <p className="category-leaderboard-pack">{row.creatorName}</p>
                <p className="category-leaderboard-author">
                  {row.themeName || row.packName}
                </p>
                <p className="category-leaderboard-stats">
                  🔥 {formatPurchaseCount(row.purchaseCount)} Buys
                </p>
              </button>
              <div className="category-leaderboard-actions">
                <div
                  className={[
                    "category-leaderboard-play",
                    cssPlayCta ? "is-css" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {cssPlayCta ? (
                    <div className="mcp-photo-play-cta-css-wrap">
                      <button
                        type="button"
                        className="mcp-photo-play-cta-css mcp-photo-play-cta-css--leaderboard"
                        aria-label={`Play ${row.creatorName} for ${row.diamondCost} diamonds`}
                        onClick={() => onPlay(row)}
                      >
                        <DiamondLottie
                          className="mcp-photo-play-cta-css__diamond"
                          size={11}
                          aria-hidden
                        />
                        <span className="mcp-photo-play-cta-css__price">
                          {row.diamondCost}
                        </span>
                        <Play
                          className="mcp-photo-play-cta-css__play"
                          size={11}
                          strokeWidth={2.4}
                          fill="currentColor"
                          aria-hidden
                        />
                      </button>
                    </div>
                  ) : (
                    <CtaButton
                      {...ctaButtonPropsFromTemplate("squircleCTA")}
                      fillParent
                      label="Play"
                      leadingIcon={
                        <>
                          <DiamondLottie
                            className="category-leaderboard-play-diamond"
                            size={14}
                            aria-hidden
                          />
                          <span className="category-leaderboard-play-cost">
                            {row.diamondCost}
                          </span>
                          <Play
                            className="category-leaderboard-play-triangle"
                            size={11}
                            strokeWidth={2.4}
                            fill="currentColor"
                            aria-hidden
                          />
                        </>
                      }
                      costAmount={null}
                      cornerRadius={999}
                      aria-label={`Play ${row.creatorName} for ${row.diamondCost} diamonds`}
                      onClick={() => onPlay(row)}
                    />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
