import { useCallback, useEffect, useState } from "react";
import { CategoryLeaderboard } from "@/components/home/CategoryLeaderboard";
import { HomeSiteFooter } from "@/components/home/HomeSiteFooter";
import { useMarkPageReady } from "@/shared/ui/usePageReady";
import {
  fetchLeaderboard,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/services/homepage";

type PageStatus = "loading" | "loaded" | "error";

/**
 * Rank tab — leaderboard only (lifted from the former homepage).
 */
export function RankScreen({
  onStartPlaying,
}: {
  onStartPlaying?: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
    characterId?: string;
    themeName?: string;
  }) => void;
}) {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [category, setCategory] = useState<LeaderboardCategory>("purchased");
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);

  useMarkPageReady(status !== "loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setBoard(await fetchLeaderboard("purchased"));
      setCategory("purchased");
      setStatus("loaded");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeCategory(next: LeaderboardCategory) {
    setCategory(next);
    setBoardLoading(true);
    try {
      setBoard(await fetchLeaderboard(next));
    } finally {
      setBoardLoading(false);
    }
  }

  function playRow(row: LeaderboardRow) {
    onStartPlaying?.({
      packId: row.packId,
      packName: row.packName,
      themeName: row.themeName,
      price: String(row.diamondCost),
      creator: row.creatorName,
      characterId: row.characterId ?? row.packId,
    });
  }

  if (status === "loading") {
    return (
      <section
        data-page-scroll
        className="home-v2 relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
      >
        <div className="home-page-inner mx-auto flex w-full max-w-[var(--app-content-max,80rem)] flex-col gap-6 px-5 lg:px-8">
          <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-48 animate-pulse rounded-2xl bg-white/10" />
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section
        data-page-scroll
        className="home-v2 relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
      >
        <div className="home-page-inner mx-auto flex w-full max-w-[var(--app-content-max,80rem)] flex-1 flex-col items-center justify-center gap-3 px-5 lg:px-8">
          <p className="text-[16px] text-white/70">Couldn’t load rankings.</p>
          <p className="max-w-xs text-center text-[13px] text-white/45">
            Check your connection, then try again.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 min-h-11 rounded-full bg-[oklch(0.606_0.219_292.72)] px-5 py-2.5 text-[14px] font-semibold"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      data-page-scroll
      className="home-v2 relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
    >
      <div className="home-page-inner mx-auto w-full max-w-[var(--app-content-max,80rem)]">
        <CategoryLeaderboard
          className="is-title-sentence is-figma-board rank-leaderboard"
          title="Top Packs"
          category={category}
          rows={board}
          loading={boardLoading}
          onCategoryChange={(c) => void changeCategory(c)}
          onPlay={playRow}
          onOpen={playRow}
        />
        <HomeSiteFooter />
      </div>
    </section>
  );
}
