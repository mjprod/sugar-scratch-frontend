import { Trophy } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import {
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/services/homepage";
import { PackArt } from "./PackArt";

export function CategoryLeaderboard({
  category,
  rows,
  loading,
  onCategoryChange,
  onPlay,
  onOpen,
}: {
  category: LeaderboardCategory;
  rows: LeaderboardRow[];
  loading?: boolean;
  onCategoryChange: (c: LeaderboardCategory) => void;
  onPlay: (row: LeaderboardRow) => void;
  onOpen: (row: LeaderboardRow) => void;
}) {
  return (
    <section
      className="continue-collecting category-leaderboard"
      aria-label="Category leaderboard"
    >
      <div className="continue-collecting-header">
        <div className="continue-collecting-title-row">
          <Trophy
            className="continue-collecting-heart"
            aria-hidden="true"
          />
          <h2 className="continue-collecting-title">Top packs by purchase</h2>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Leaderboard categories"
        className="category-leaderboard-tabs"
      >
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
          <p className="category-leaderboard-empty">No featured packs available.</p>
        ) : (
          rows.slice(0, 5).map((row) => (
            <div
              key={`${row.category}-${row.packId}-${row.rank}`}
              className={[
                "category-leaderboard-row",
                row.rank <= 3 ? "is-top" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "category-leaderboard-rank",
                  row.rank === 1 ? "is-first" : "",
                  row.rank === 2 ? "is-second" : "",
                  row.rank === 3 ? "is-third" : "",
                ].join(" ")}
              >
                {row.rank}
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
                  className="!w-12 !rounded-[12px]"
                />
              </button>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="category-leaderboard-info"
              >
                <p className="category-leaderboard-pack">{row.packName}</p>
                <p className="category-leaderboard-meta">
                  {row.creatorName} · {row.purchaseCount.toLocaleString()} buys
                </p>
              </button>
              <div className="category-leaderboard-actions">
                <span
                  className="category-leaderboard-price"
                  aria-label={`${row.diamondCost} Diamonds`}
                >
                  <DiamondLottie
                    className="category-leaderboard-price-diamond shrink-0"
                    size={14}
                    aria-hidden
                  />
                  <span className="tabular-nums">{row.diamondCost}</span>
                </span>
                <div className="category-leaderboard-play">
                  <CtaButton
                    {...ctaButtonPropsFromTemplate("squircleCTA")}
                    fillParent
                    label="▶ Play"
                    costAmount={null}
                    fontSize={12}
                    cornerRadius={999}
                    aria-label={`Play ${row.packName}`}
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
