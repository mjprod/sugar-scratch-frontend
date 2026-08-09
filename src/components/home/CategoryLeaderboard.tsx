import { ChevronRight, Play, Trophy } from "lucide-react";
import {
  formatPrice,
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
  onViewFull,
}: {
  category: LeaderboardCategory;
  rows: LeaderboardRow[];
  loading?: boolean;
  onCategoryChange: (c: LeaderboardCategory) => void;
  onPlay: (row: LeaderboardRow) => void;
  onOpen: (row: LeaderboardRow) => void;
  onViewFull: () => void;
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
          <h2 className="continue-collecting-title">CATEGORY LEADERBOARD</h2>
        </div>
        <button
          type="button"
          className="continue-collecting-see-all"
          onClick={onViewFull}
        >
          SEE ALL
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
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
                <span className="category-leaderboard-price">
                  {formatPrice(row.price)}
                </span>
                <button
                  type="button"
                  onClick={() => onPlay(row)}
                  className="category-leaderboard-play"
                  aria-label={`Play ${row.packName}`}
                >
                  <Play className="size-3 fill-current" aria-hidden="true" />
                  Play
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
