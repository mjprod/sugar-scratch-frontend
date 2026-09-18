import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { CategoryLeaderboard } from "@/components/home/CategoryLeaderboard";
import { ContinueCollecting } from "@/components/home/ContinueCollecting";
import { ExploreCreators } from "@/components/home/ExploreCreators";
import { HomeSiteFooter } from "@/components/home/HomeSiteFooter";
import { PlayerWelcomeBar } from "@/components/home/PlayerWelcomeBar";
import { FIGMA_HOME_PLAY_STEPS, PlaySteps } from "@/components/home/PlaySteps";
import { SpotlightBanner } from "@/components/home/SpotlightBanner";
import { useSearch } from "@/contexts/SearchContext";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  fetchHomepage,
  fetchLeaderboard,
  splitContinueCollectingItems,
  type ContinueCollectingItem,
  type HomepageData,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/services/homepage";

const FeaturedCoverFlow = lazy(() =>
  import("@/components/home/FeaturedCoverFlow").then((m) => ({
    default: m.FeaturedCoverFlow,
  })),
);

type PageStatus = "loading" | "loaded" | "error";

/**
 * Logged-in homepage v2 — Figma Home (node 2:20).
 * Same data/wiring as HomeScreen; layout drops the discover reel bento and
 * stacks How to Play → Continue Collecting → Explore Creators.
 */
export function HomeVersion2Screen({
  onRestart,
  onStartPlaying,
  onOpenCreator,
  onClaimDaily,
  onClaimAttempt,
  onOpenCollection,
}: {
  onRestart: () => void;
  onStartPlaying?: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
    characterId?: string;
    themeName?: string;
  }) => void;
  onOpenCreator?: (creatorId: string) => void;
  onClaimDaily?: (diamonds: number) => void;
  onClaimAttempt?: () => boolean;
  onOpenCollection?: (creatorId: string) => boolean;
}) {
  const { openSearch } = useSearch();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [home, setHome] = useState<HomepageData | null>(null);
  const [category, setCategory] = useState<LeaderboardCategory>("all");
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [heroReady, setHeroReady] = useState(false);

  useMarkPageReady(status === "error" || heroReady);

  const load = useCallback(async () => {
    setHeroReady(false);
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
    foilId?: string;
    name: string;
    creatorName: string;
    diamondCost: number;
    themeName?: string;
  }) {
    onStartPlaying?.({
      packId: pack.foilId ?? pack.id,
      packName: pack.name,
      themeName: pack.themeName,
      price: String(pack.diamondCost),
      creator: pack.creatorName,
      characterId: pack.id,
    });
  }

  function playRow(row: LeaderboardRow) {
    playPack({
      id: row.characterId ?? row.packId,
      foilId: row.characterId ? row.packId : undefined,
      name: row.packName,
      creatorName: row.creatorName,
      diamondCost: row.diamondCost,
      themeName: row.themeName,
    });
  }

  function openCollection(item: ContinueCollectingItem) {
    if (onOpenCollection && !onOpenCollection(item.creatorId)) return;
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
        className="home-v2 relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pb-[var(--app-footer-offset)] lg:pb-12"
      >
        <div className="home-featured-coverflow is-loading" aria-hidden="true" />
        <div className="home-page-inner mx-auto flex w-full max-w-[var(--app-content-max,80rem)] flex-col gap-6 px-5 lg:px-8">
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
        className="home-v2 relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
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

  const { continueCollecting, justDropIn } = splitContinueCollectingItems(
    home.continueCollecting,
  );
  const exploreItems =
    justDropIn.length > 0
      ? justDropIn
      : home.continueCollecting.filter((item) => item.collected === 0).length > 0
        ? home.continueCollecting.filter((item) => item.collected === 0)
        : home.continueCollecting;

  return (
    <section
      data-page-scroll
      className="home-v2 relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pb-[var(--app-footer-offset)] lg:pb-12"
    >
      <Suspense
        fallback={
          <div className="home-featured-coverflow is-loading" aria-hidden="true" />
        }
      >
        <FeaturedCoverFlow
          featured={home.featured}
          onPlay={playPack}
          onReady={() => setHeroReady(true)}
          influencerBackdrop
          showStatusPager
        />
      </Suspense>

      <div className="home-page-inner home-page-inner--after-hero mx-auto flex w-full max-w-[var(--app-content-max,80rem)] flex-col gap-[15px] px-5 lg:px-8">
        {onClaimDaily ? (
          <PlayerWelcomeBar
            onClaimed={onClaimDaily}
            onClaimAttempt={onClaimAttempt}
            claimLabel="Claim Now!"
            readySubtitle="Claim today’s free gift…"
          />
        ) : null}

        <PlaySteps title="How to Play" steps={FIGMA_HOME_PLAY_STEPS} />

        <ContinueCollecting
          className="is-title-sentence is-avatar-strip"
          title="Continue Collecting"
          seeAllLabel="See All"
          avatarOnly
          items={
            continueCollecting.length > 0 ? continueCollecting : justDropIn
          }
          onOpen={openCollection}
          onSeeAllClick={openSearch}
        />

        <ExploreCreators
          items={exploreItems}
          onOpen={openCollection}
          onSeeAllClick={openSearch}
        />
      </div>

      <SpotlightBanner />

      <div className="home-page-inner mx-auto w-full max-w-[var(--app-content-max,80rem)]">
        <CategoryLeaderboard
          className="is-title-sentence is-figma-board"
          title="Top Packs By Purchase"
          category={category}
          rows={board}
          loading={boardLoading}
          onCategoryChange={(c) => void changeCategory(c)}
          onPlay={playRow}
          onOpen={playRow}
        />

        <button
          type="button"
          onClick={onRestart}
          className="mt-10 mb-2 text-center text-[12px] text-white/30 underline-offset-2 hover:text-white/50 hover:underline"
        >
          Restart prototype (clears first-visit flags)
        </button>

        <HomeSiteFooter />
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-4 py-2 text-[13px] text-white/85 backdrop-blur-md">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
