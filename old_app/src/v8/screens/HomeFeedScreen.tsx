import { Bell, Gem, Sparkles, UserRound } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CreatorFeedCard,
  useVideoRegistry,
} from "../components/home/CreatorFeedCard";
import {
  fetchHomeFeedPage,
  readHomeFeedCache,
  toPurchasePack,
  writeHomeFeedCache,
  type HomeFeedCreator,
} from "../flow/creatorFeed";

const SNAP_MS = 220;

export function HomeFeedScreen({
  coins,
  diamonds,
  avatar,
  active,
  guest = false,
  resumeLikeId = null,
  onResumeLikeConsumed,
  onBuyPack,
  onLikeAttempt,
  onProfile,
  onOpenStore,
  onNotify,
  personalizationPrompt = null,
}: {
  coins: number;
  diamonds: number;
  avatar: string | null;
  /** When false, stay mounted but pause media (preserve scroll). */
  active: boolean;
  guest?: boolean;
  /** After auth, apply this like without a second tap. */
  resumeLikeId?: string | null;
  onResumeLikeConsumed?: () => void;
  onBuyPack: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
  }) => void;
  /** Guest like gate — return false to block toggle. */
  onLikeAttempt?: (itemId: string) => boolean;
  onProfile: () => void;
  onOpenStore?: () => void;
  onNotify?: () => void;
  personalizationPrompt?: ReactNode;
}) {
  const cached = readHomeFeedCache();
  const [items, setItems] = useState<HomeFeedCreator[]>(cached?.items ?? []);
  const [status, setStatus] = useState<"loading" | "loaded" | "error" | "empty">(
    cached?.items.length ? "loaded" : "loading",
  );
  const [activeId, setActiveId] = useState<string | null>(
    cached?.activeId ?? null,
  );
  const [cursor, setCursor] = useState<string | null>(cached?.cursor ?? null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useVideoRegistry();
  const loadingMoreRef = useRef(false);
  const scrollIndexRef = useRef(cached?.scrollIndex ?? 0);
  const restoredRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  const persist = useCallback(
    (patch: Partial<{
      items: HomeFeedCreator[];
      cursor: string | null;
      hasMore: boolean;
      activeId: string | null;
      scrollIndex: number;
    }>) => {
      const base = readHomeFeedCache() ?? {
        items,
        cursor,
        hasMore,
        activeId,
        scrollIndex: scrollIndexRef.current,
      };
      writeHomeFeedCache({ ...base, ...patch });
    },
    [activeId, cursor, hasMore, items],
  );

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchHomeFeedPage(null);
      if (!page.items.length) {
        setItems([]);
        setStatus("empty");
        setActiveId(null);
        setCursor(null);
        setHasMore(false);
        writeHomeFeedCache({
          items: [],
          cursor: null,
          hasMore: false,
          activeId: null,
          scrollIndex: 0,
        });
        return;
      }
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setActiveId(page.items[0]?.id ?? null);
      scrollIndexRef.current = 0;
      setStatus("loaded");
      writeHomeFeedCache({
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        activeId: page.items[0]?.id ?? null,
        scrollIndex: 0,
      });
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: 0 });
      });
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (cached?.items.length) return;
    void loadInitial();
  }, [cached?.items.length, loadInitial]);

  useEffect(() => {
    if (status !== "loaded" || restoredRef.current) return;
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    restoredRef.current = true;
    const height = root.clientHeight || 1;
    const index = Math.min(
      scrollIndexRef.current,
      Math.max(0, items.length - 1),
    );
    root.scrollTo({ top: index * height });
    const next = items[index];
    if (next) setActiveId(next.id);
  }, [status, items]);

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      if (!active || id !== activeId) {
        video.pause();
        return;
      }
      video.muted = true;
      void video.play().catch(() => {
        /* poster still shows */
      });
    });
  }, [active, activeId, items, videoRefs]);

  const go = useCallback(
    (delta: number) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const height = root.clientHeight;
      const next = Math.round(root.scrollTop / height) + delta;
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      root.scrollTo({
        top: clamped * height,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [items.length, reducedMotion],
  );

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  async function loadMore() {
    if (!hasMore || loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchHomeFeedPage(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const next = page.items.filter((item) => !seen.has(item.id));
        const merged = [...prev, ...next];
        persist({
          items: merged,
          cursor: page.nextCursor,
          hasMore: page.hasMore,
        });
        return merged;
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      /* keep browsing loaded cards */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  function onScroll() {
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    const height = root.clientHeight || 1;
    const index = Math.round(root.scrollTop / height);
    scrollIndexRef.current = index;
    const next = items[Math.max(0, Math.min(items.length - 1, index))];
    if (next && next.id !== activeId) {
      setActiveId(next.id);
      persist({ activeId: next.id, scrollIndex: index });
    } else {
      persist({ scrollIndex: index });
    }

    const remaining = items.length - 1 - index;
    if (remaining <= 2) void loadMore();
  }

  function toggleLike(id: string) {
    if (onLikeAttempt && !onLikeAttempt(id)) return;
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, liked: !item.liked } : item,
      );
      persist({ items: next });
      return next;
    });
  }

  useEffect(() => {
    if (!resumeLikeId) return;
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === resumeLikeId ? { ...item, liked: true } : item,
      );
      persist({ items: next });
      return next;
    });
    onResumeLikeConsumed?.();
  }, [resumeLikeId, onResumeLikeConsumed, persist]);

  return (
    <section
      className={["hf-page", active ? "is-active" : "is-inactive"].join(" ")}
      aria-label="Home Feed"
      aria-hidden={!active}
      {...(!active ? { inert: true } : {})}
    >
      {personalizationPrompt}
      <div className="hf-frame">
        <header className="hf-topnav">
          <span className="hf-logo" aria-label="Sugar">
            Sugar
          </span>
          <div className="hf-balances" aria-label="Balances">
            <span className="hf-balance">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">{coins}</span>
            </span>
            <button
              type="button"
              className="hf-balance is-button"
              onClick={onOpenStore}
              aria-label={`${diamonds} diamonds`}
            >
              <Gem className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">{diamonds}</span>
            </button>
          </div>
          <div className="hf-top-actions">
            <button
              type="button"
              className="hf-icon-btn"
              aria-label="Notifications"
              onClick={onNotify}
            >
              <Bell className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hf-avatar-btn"
              aria-label={guest ? "Sign in" : "Profile"}
              onClick={onProfile}
            >
              {!guest && avatar ? (
                <img src={avatar} alt="" className="hf-avatar-img" />
              ) : (
                <UserRound className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        {status === "loading" ? (
          <div className="hf-state" aria-busy="true">
            <div className="hf-skeleton" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="hf-state" role="alert">
            <p className="hf-state-title">Unable to load creators.</p>
            <button
              type="button"
              className="hf-state-cta"
              onClick={() => void loadInitial()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="hf-state">
            <p className="hf-state-title">No creators available.</p>
            <p className="hf-state-copy">Please check back later.</p>
            <button
              type="button"
              className="hf-state-cta"
              onClick={() => void loadInitial()}
            >
              Refresh
            </button>
          </div>
        ) : null}

        {status === "loaded" ? (
          <div
            ref={scrollerRef}
            className="hf-viewport"
            onScroll={onScroll}
            style={
              reducedMotion
                ? undefined
                : ({
                    scrollBehavior: "smooth",
                    "--hf-snap-ms": `${SNAP_MS}ms`,
                  } as CSSProperties)
            }
          >
            {items.map((item) => (
              <div key={item.id} className="hf-slide">
                <CreatorFeedCard
                  item={item}
                  active={active && item.id === activeId}
                  onLike={() => toggleLike(item.id)}
                  onBuy={() => onBuyPack(toPurchasePack(item))}
                  videoRef={(node) => {
                    if (node) videoRefs.current.set(item.id, node);
                    else videoRefs.current.delete(item.id);
                  }}
                />
              </div>
            ))}
            {loadingMore ? (
              <div className="hf-loading-more" aria-live="polite">
                Loading more…
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
