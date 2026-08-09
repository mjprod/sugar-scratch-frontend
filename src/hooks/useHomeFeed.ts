import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchHomeFeedPage,
  readHomeFeedCache,
  writeHomeFeedCache,
  type HomeFeedCreator,
} from "@/services/creatorFeed";

/** Paginated home-feed data + cache restore. */
export function useHomeFeed(enabled = true) {
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
  const loadingMoreRef = useRef(false);
  const scrollIndexRef = useRef(cached?.scrollIndex ?? 0);

  const persist = useCallback(
    (
      patch: Partial<{
        items: HomeFeedCreator[];
        cursor: string | null;
        hasMore: boolean;
        activeId: string | null;
        scrollIndex: number;
      }>,
    ) => {
      writeHomeFeedCache({
        items: patch.items ?? items,
        cursor: patch.cursor ?? cursor,
        hasMore: patch.hasMore ?? hasMore,
        activeId: patch.activeId ?? activeId,
        scrollIndex: patch.scrollIndex ?? scrollIndexRef.current,
      });
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
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (cached?.items.length) return;
    void loadInitial();
  }, [cached?.items.length, enabled, loadInitial]);

  const loadMore = useCallback(async () => {
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
  }, [cursor, hasMore, persist]);

  return {
    items,
    setItems,
    status,
    setStatus,
    activeId,
    setActiveId,
    cursor,
    hasMore,
    loadingMore,
    scrollIndexRef,
    persist,
    loadInitial,
    loadMore,
  };
}
