import { Gem, Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDiscoveryFeed, type FeedPreview } from "../flow/homepage";

/**
 * Explore — large fixed 9:16 portrait discovery.
 * Height drives width; Like sits beside the media group, not the browser edge.
 */
export function FeedScreen({
  onStartPlaying,
}: {
  onStartPlaying?: (pack: {
    packId: string;
    packName: string;
    price: string;
    creator: string;
  }) => void;
} = {}) {
  const [items, setItems] = useState<FeedPreview[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    let alive = true;
    void fetchDiscoveryFeed()
      .then((data) => {
        if (!alive) return;
        setItems(data);
        setActiveId(data[0]?.id ?? null);
        setStatus("loaded");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      if (id === activeId) {
        video.muted = true;
        void video.play().catch(() => {
          /* poster still shows if autoplay is blocked */
        });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeId, items]);

  useEffect(() => {
    function onReselect(event: Event) {
      const detail = (event as CustomEvent<{ tab?: string }>).detail;
      if (detail?.tab !== "feed") return;
      const root = scrollerRef.current;
      if (!root || !items[0]) return;
      root.scrollTo({ top: 0, behavior: "smooth" });
      setActiveId(items[0].id);
    }
    window.addEventListener("sugar:footer-reselect", onReselect);
    return () => window.removeEventListener("sugar:footer-reselect", onReselect);
  }, [items]);

  const go = useCallback(
    (delta: number) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;
      const height = root.clientHeight;
      const next = Math.round(root.scrollTop / height) + delta;
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      root.scrollTo({ top: clamped * height, behavior: "smooth" });
    },
    [items.length],
  );

  useEffect(() => {
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
  }, [go]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    const height = root.clientHeight || 1;
    const index = Math.round(root.scrollTop / height);
    const next = items[Math.max(0, Math.min(items.length - 1, index))];
    if (next && next.id !== activeId) setActiveId(next.id);
  }

  function toggleLike(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, liked: !item.liked } : item,
      ),
    );
  }

  if (status === "loading") {
    return (
      <section className="explore-page explore-page--state" aria-busy="true">
        <div className="explore-skeleton" />
      </section>
    );
  }

  if (status === "error" || !items.length) {
    return (
      <section className="explore-page explore-page--state">
        <p className="text-[14px] text-white/55">Explore unavailable. Try again later.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Explore creators"
      className="explore-page flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={scrollerRef}
        className="explore-viewport"
        onScroll={onScroll}
      >
        {items.map((item) => (
          <ExploreSlide
            key={item.id}
            item={item}
            active={item.id === activeId}
            onLike={() => toggleLike(item.id)}
            onBuy={() =>
              onStartPlaying?.({
                packId: item.packId,
                packName: item.packName,
                price: `${item.diamondCost} Diamonds`,
                creator: item.creatorName,
              })
            }
            videoRef={(node) => {
              if (node) videoRefs.current.set(item.id, node);
              else videoRefs.current.delete(item.id);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ExploreSlide({
  item,
  active,
  onLike,
  onBuy,
  videoRef,
}: {
  item: FeedPreview;
  active: boolean;
  onLike: () => void;
  onBuy: () => void;
  videoRef: (node: HTMLVideoElement | null) => void;
}) {
  const [burst, setBurst] = useState(false);
  const meta = [
    `${item.creatorName} Collection`,
    `${item.cardCount} Cards`,
    item.limited ? "Limited" : "Standard",
  ].join(" · ");

  function like() {
    onLike();
    if (!item.liked) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 520);
    }
  }

  return (
    <article
      className="explore-feed-item"
      aria-label={`${item.creatorName} · ${item.collectionName}`}
    >
      <div className="explore-scene">
        <div className="explore-content-group">
          <div
            className={["explore-media-stage", active ? "is-active" : ""].join(" ")}
          >
            <video
              ref={videoRef}
              src={item.videoUrl}
              poster={item.posterUrl}
              playsInline
              muted
              loop
              preload="metadata"
              className="explore-video"
            />
            <div className="explore-media-shade" aria-hidden="true" />

            <div
              className={["explore-overlay", active ? "is-visible" : ""].join(" ")}
            >
              <h2 className="explore-creator">{item.creatorName}</h2>
              <p className="explore-collection">{item.collectionName}</p>
              <p className="explore-meta">{meta}</p>
              <button type="button" className="explore-buy" onClick={onBuy}>
                <span>Buy Pack</span>
                <span className="explore-buy-price">
                  <Gem className="size-3.5" aria-hidden="true" />
                  <span className="tabular-nums">{item.diamondCost}</span>
                </span>
              </button>
            </div>
          </div>

          <div className="explore-like-wrap">
            <button
              type="button"
              className={[
                "explore-like",
                item.liked ? "is-liked" : "",
                burst ? "is-burst" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={item.liked ? "Unlike" : "Like"}
              aria-pressed={item.liked}
              onClick={like}
            >
              <Heart
                className="explore-like-icon"
                fill={item.liked ? "currentColor" : "none"}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {burst ? (
                <span className="explore-like-burst" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
