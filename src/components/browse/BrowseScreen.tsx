import { useCallback, useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { DailyRewardHero } from "@/components/rewards/DailyRewardHero";
import { CategoryLeaderboard } from "@/components/home/CategoryLeaderboard";
import { ContinueCollecting } from "@/components/home/ContinueCollecting";
import { FeaturedCarousel } from "@/components/home/FeaturedCarousel";
import { PackLibrary } from "@/components/home/PackLibrary";
import {
  fetchHomepage,
  fetchLeaderboard,
  type ContinueCollectingItem,
  type FeaturedPack,
  type HomepageData,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/services/homepage";

type PageStatus = "loading" | "loaded" | "error";

/**
 * Homepage Spec 3.0 — holographic carousel · progression · leaderboard
 */
export function HomeScreen({
  showTutorial,
  onTutorialDone,
  onSkipTutorial,
  onRestart,
  onStartPlaying,
  onOpenCreator,
  onClaimDaily,
}: {
  showTutorial?: boolean;
  onTutorialDone?: () => void;
  onSkipTutorial?: () => void;
  onRestart: () => void;
  onStartPlaying?: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
  }) => void;
  onOpenCreator?: (creatorId: string) => void;
  onClaimDaily?: (diamonds: number) => void;
}) {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [home, setHome] = useState<HomepageData | null>(null);
  const [category, setCategory] = useState<LeaderboardCategory>("all");
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await fetchHomepage();
      setHome(data);
      setBoard(await fetchLeaderboard("all"));
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

  function playPack(pack: {
    id: string;
    name: string;
    creatorName: string;
    diamondCost: number;
  }) {
    onStartPlaying?.({
      packId: pack.id,
      packName: pack.name,
      price: String(pack.diamondCost),
      creator: pack.creatorName,
    });
  }

  function playFeatured(pack: FeaturedPack) {
    playPack({
      id: pack.id,
      name: pack.name,
      creatorName: pack.creatorName,
      diamondCost: pack.diamondCost,
    });
  }

  function playRow(row: LeaderboardRow) {
    playPack({
      id: row.packId,
      name: row.packName,
      creatorName: row.creatorName,
      diamondCost: row.diamondCost,
    });
  }

  function openCollection(item: ContinueCollectingItem) {
    if (onOpenCreator) {
      onOpenCreator(item.creatorId);
      return;
    }
    setToast(`${item.creatorName} collection · ${item.percent}% complete`);
    window.setTimeout(() => setToast(null), 2200);
  }

  if (status === "loading") {
    return (
      <section
        data-page-scroll
        className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
      >
        <div className="home-page-inner mx-auto flex w-full max-w-[var(--app-content-max,80rem)] flex-col gap-6 px-5 lg:px-8">
          <div className="mx-auto h-[480px] w-[300px] animate-pulse rounded-[28px] bg-white/10 [clip-path:polygon(4%_1.5%,96%_1.5%,99%_6%,100%_48%,99%_94%,96%_98.5%,4%_98.5%,1%_94%,0%_52%,1%_6%)]" />
          <div className="mx-auto flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="size-2 animate-pulse rounded-full bg-white/15" />
            ))}
          </div>
          <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-48 animate-pulse rounded-2xl bg-white/10" />
        </div>
      </section>
    );
  }

  if (status === "error" || !home) {
    return (
      <section
        data-page-scroll
        className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
      >
        <div className="home-page-inner mx-auto flex w-full max-w-[var(--app-content-max,80rem)] flex-1 flex-col items-center justify-center gap-3 px-5 lg:px-8">
          <p className="text-[16px] text-white/70">Couldn’t load homepage.</p>
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
      className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
    >
      {showTutorial ? (
        <button
          type="button"
          aria-label="Dismiss tutorial"
          className="absolute inset-0 z-20 bg-black/60"
          onClick={onTutorialDone}
        />
      ) : null}

      {/*
        Full-width scroll shell keeps the scrollbar on the viewport edge.
        Content width is constrained by the inner wrapper (same as other pages).
      */}
      <div className="home-page-inner mx-auto w-full max-w-[var(--app-content-max,80rem)] px-5 lg:px-8">
        <div
          className={[
            "relative",
            showTutorial
              ? "z-30 rounded-[28px] ring-2 ring-[oklch(0.656_0.212_354.31)] ring-offset-4 ring-offset-transparent [animation:tutorial-pulse_1.8s_ease-in-out_infinite]"
              : "",
          ].join(" ")}
        >
          <FeaturedCarousel
            packs={home.featured}
            onPlay={playFeatured}
            onOpenDetail={playFeatured}
          />
        </div>

        {showTutorial ? (
          <div className="pointer-events-none relative z-40 mt-4 flex justify-center">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[oklch(0.656_0.212_354.31)]/40 bg-[oklch(0.19_0.022_333.66)]/95 px-4 py-3 text-center shadow-[0_16px_40px_oklch(0_0_0_/_0.45)] backdrop-blur-md">
              <p className="text-[14px] font-medium text-[oklch(0.823_0.11_346.02)]">
                Swipe the carousel to discover featured packs.
              </p>
              <div className="mt-2 flex justify-center gap-4 text-[13px]">
                <button type="button" className="text-[oklch(0.823_0.11_346.02)]/70" onClick={onSkipTutorial}>
                  Skip tutorial
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-full bg-[oklch(0.606_0.219_292.72)] px-4 font-semibold text-white"
                  onClick={onTutorialDone}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="min-h-11 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.606_0.219_292.72)]"
          >
            View All Packs
          </button>
        </div>

        {onClaimDaily ? (
          <section
            className="hub-module hub-module--today mt-8"
            aria-labelledby="browse-daily-heading"
          >
            <h2
              id="browse-daily-heading"
              className="hub-section-label hub-section-label--today"
            >
              Today
            </h2>
            <DailyRewardHero onClaimed={onClaimDaily} />
          </section>
        ) : null}

        <div className="mt-10">
          <ContinueCollecting
            items={home.continueCollecting}
            onOpen={openCollection}
            onSeeAllClick={() => setLibraryOpen(true)}
          />
        </div>

        <div className="mt-10">
          <CategoryLeaderboard
            category={category}
            rows={board}
            loading={boardLoading}
            onCategoryChange={(c) => void changeCategory(c)}
            onPlay={playRow}
            onOpen={playRow}
            onViewFull={() => setLibraryOpen(true)}
          />
        </div>

        <section
          className="hub-module mt-10"
          aria-labelledby="browse-upcoming-heading"
        >
          <div className="hub-section-row">
            <h2
              id="browse-upcoming-heading"
              className="hub-section-label hub-section-label--upcoming"
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Upcoming
            </h2>
          </div>
          <div className="hub-upcoming-empty">
            <span className="hub-upcoming-empty-icon" aria-hidden="true">
              <CalendarDays className="size-5" />
            </span>
            <div className="hub-upcoming-empty-copy">
              <p className="hub-upcoming-empty-title">No live events right now.</p>
              <p className="hub-upcoming-empty-sub">Check back tomorrow.</p>
            </div>
            <span className="hub-upcoming-empty-atmosphere" aria-hidden="true" />
          </div>
        </section>

        <button
          type="button"
          onClick={onRestart}
          className="mt-10 mb-2 text-center text-[12px] text-white/30 underline-offset-2 hover:text-white/50 hover:underline"
        >
          Restart prototype (clears first-visit flags)
        </button>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-4 py-2 text-[13px] text-white/85 backdrop-blur-md">
          {toast}
        </div>
      ) : null}

      {libraryOpen ? (
        <PackLibrary
          onClose={() => setLibraryOpen(false)}
          onPlay={(pack) => {
            setLibraryOpen(false);
            playFeatured(pack);
          }}
        />
      ) : null}
    </section>
  );
}
