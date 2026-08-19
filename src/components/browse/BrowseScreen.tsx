import { useCallback, useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { DailyRewardHero } from "@/components/rewards/DailyRewardHero";
import { CategoryLeaderboard } from "@/components/home/CategoryLeaderboard";
import { ContinueCollecting } from "@/components/home/ContinueCollecting";
import { DiscoverReel } from "@/components/home/DiscoverReel";
import { FeaturedCoverFlow } from "@/components/home/FeaturedCoverFlow";
import { PackLibrary } from "@/components/home/PackLibrary";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
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

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function destinationScrollTop(scroller: HTMLElement, target: HTMLElement) {
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  return (
    scroller.scrollTop +
    (target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) -
    margin
  );
}

function scrollToDailyReward(target: HTMLElement, reduce: boolean) {
  const scroller = target.closest<HTMLElement>("[data-page-scroll]");
  if (!scroller) {
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    return () => { };
  }

  const stage =
    scroller.querySelector<HTMLElement>(".home-page-inner") ?? scroller;
  const dest = destinationScrollTop(scroller, target);
  const start = scroller.scrollTop;
  const pullPx = Math.min(40, Math.max(22, Math.abs(dest - start) * 0.08));

  if (reduce || Math.abs(dest - start) < 2) {
    scroller.scrollTop = dest;
    return () => { };
  }

  let raf = 0;
  let cancelled = false;
  const previousTransform = stage.style.transform;
  const previousWillChange = stage.style.willChange;

  const clearStage = () => {
    stage.style.transform = previousTransform;
    stage.style.willChange = previousWillChange;
  };

  const runFrom = (now: number, duration: number, ease: (t: number) => number, apply: (u: number) => void) =>
    new Promise<void>((resolve) => {
      const tick = (frame: number) => {
        if (cancelled) {
          resolve();
          return;
        }
        const u = Math.min(1, (frame - now) / duration);
        apply(ease(u));
        if (u < 1) {
          raf = window.requestAnimationFrame(tick);
          return;
        }
        resolve();
      };
      raf = window.requestAnimationFrame(tick);
    });

  stage.style.willChange = "transform";

  void (async () => {
    // Pull the page up first — real scroll if we can, overscroll transform if we're already at the top.
    const canScrollUp = start > 1;
    await runFrom(performance.now(), 320, easeInOutCubic, (u) => {
      if (canScrollUp) {
        scroller.scrollTop = start - pullPx * u;
        return;
      }
      stage.style.transform = `translateY(${pullPx * u}px)`;
    });
    if (cancelled) return;
    await new Promise((resolve) => window.setTimeout(resolve, 90));
    if (cancelled) return;

    const travelStart = scroller.scrollTop;
    const travelDest = destinationScrollTop(scroller, target);
    const startLift = canScrollUp ? 0 : pullPx;

    await runFrom(performance.now(), 900, easeOutCubic, (u) => {
      if (startLift) {
        stage.style.transform = `translateY(${startLift * (1 - u)}px)`;
      }
      scroller.scrollTop = travelStart + (travelDest - travelStart) * u;
    });

    if (!cancelled) clearStage();
  })();

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(raf);
    clearStage();
  };
}

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
  onLikeAttempt,
  resumeLikeId = null,
  onResumeLikeConsumed,
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
  onLikeAttempt?: (itemId: string) => boolean;
  resumeLikeId?: string | null;
  onResumeLikeConsumed?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [home, setHome] = useState<HomepageData | null>(null);
  const [category, setCategory] = useState<LeaderboardCategory>("all");
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
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

  useEffect(() => {
    const state = location.state as { scrollToDailyReward?: boolean } | null;
    if (!state?.scrollToDailyReward || status !== "loaded") return;

    // Desktop stays at the top of Home; mobile docks to the daily reward.
    if (window.matchMedia("(min-width: 507px)").matches) {
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let cancelScroll = () => { };
    let started = false;

    void (async () => {
      await waitForNextPaint();
      const target = document.getElementById("daily-reward");
      if (cancelled || !target || target.getBoundingClientRect().height < 2) return;

      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (cancelled) return;

      started = true;
      cancelScroll = scrollToDailyReward(target, reduce);
      navigate(location.pathname, { replace: true, state: {} });
    })();

    return () => {
      cancelled = true;
      // Clearing the route flag remounts this effect — don't abort a scroll
      // that already started.
      if (!started) cancelScroll();
    };
  }, [location.pathname, location.state, navigate, status]);

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

      <div
        className={[
          "relative",
          showTutorial
            ? "z-30 ring-2 ring-[oklch(0.656_0.212_354.31)] ring-offset-4 ring-offset-transparent [animation:tutorial-pulse_1.8s_ease-in-out_infinite]"
            : "",
        ].join(" ")}
      >
        <FeaturedCoverFlow
          featured={home.featured}
          onPlay={playPack}
          onReady={() => setHeroReady(true)}
        />
      </div>

      {showTutorial ? (
        <div className="pointer-events-none relative z-40 mt-4 flex justify-center px-5 lg:px-8">
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

      {/*
        Full-width scroll shell keeps the scrollbar on the viewport edge.
        Content width is constrained by the inner wrapper (same as other pages).
      */}
      <div className="home-page-inner mx-auto w-full max-w-[var(--app-content-max,80rem)] px-5 lg:px-8">
        <div className="home-view-all-packs mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="min-h-11 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.606_0.219_292.72)]"
          >
            View All Packs
          </button>
        </div>

        <div className="hub-today-bento mt-8">
          <div className="hub-today-bento-stack">
            {onClaimDaily ? (
              <section
                className="hub-module hub-module--today"
                aria-labelledby="daily-reward"
              >
          
                <DailyRewardHero onClaimed={onClaimDaily} />
              </section>
            ) : null}

            <ContinueCollecting
              items={home.continueCollecting}
              onOpen={openCollection}
              onSeeAllClick={() => setLibraryOpen(true)}
            />
          </div>

          <aside className="hub-today-bento-reel" aria-label="Discover video reel">
            <div className="hub-today-bento-reel-frame">
              <DiscoverReel
                onBuyPack={(pack) => onStartPlaying?.(pack)}
                onLikeAttempt={onLikeAttempt}
                onOpenCreator={onOpenCreator}
                resumeLikeId={resumeLikeId}
                onResumeLikeConsumed={onResumeLikeConsumed}
              />
            </div>
          </aside>
        </div>
      </div>

      <section
        className="hub-spotlight-band"
        aria-hidden="true"
      />

      <div className="home-page-inner mx-auto w-full max-w-[var(--app-content-max,80rem)] px-5 lg:px-8">
        <div>
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
