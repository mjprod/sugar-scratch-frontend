import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
import {
  filterSearchCatalog,
  loadSearchCatalog,
  type SearchCatalog,
  type SearchCreator,
  type SearchFilter,
  type SearchPack,
} from "@/services/search";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { isVideoSrc } from "@/services/models";
/** Hold the search bar until the pack-library panel has mostly slid up. */
const BAR_ENTER_DELAY = 0.28;
/** First body cascade starts just after the bar begins fading in. */
const BODY_OPEN_DELAY = 0.16;
const BODY_UPDATE_DELAY = 0.04;
const BODY_STAGGER = 0.14;

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const BAR_ITEM = {
  hidden: { opacity: 0, y: -14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: BAR_ENTER_DELAY,
      duration: 0.38,
      ease: EASE_OUT,
    },
  },
};

/** Fade in + settle downward. */
const SEARCH_ITEM = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.26,
      ease: EASE_OUT,
    },
  },
};

function SearchReveal({
  className,
  children,
  as = "div",
  style,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section";
  style?: CSSProperties;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-hidden"?: boolean;
}) {
  const motionProps = {
    className,
    variants: SEARCH_ITEM,
    style,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-hidden": ariaHidden,
  };
  if (as === "section") {
    return <motion.section {...motionProps}>{children}</motion.section>;
  }
  return <motion.div {...motionProps}>{children}</motion.div>;
}

export function SearchScreen({
  onCancel,
  onOpenCreator,
  onOpenPack,
}: {
  onCancel: () => void;
  onOpenCreator: (creatorId: string) => void;
  onOpenPack: (pack: SearchPack) => void;
}) {
  const inputId = useId();
  const reduce = useReducedMotion();
  const openSequence = useRef(true);
  const [catalog, setCatalog] = useState<SearchCatalog | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");

  // After the open cascade, later body swaps (typing / filters) stagger tightly.
  useEffect(() => {
    if (reduce) {
      openSequence.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      openSequence.current = false;
    }, Math.round((BODY_OPEN_DELAY + 0.4) * 1000));
    return () => window.clearTimeout(t);
  }, [reduce]);

  const bodyStagger = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: openSequence.current
          ? BODY_OPEN_DELAY
          : BODY_UPDATE_DELAY,
        staggerChildren: BODY_STAGGER,
      },
    },
  };

  useEffect(() => {
    let alive = true;
    void loadSearchCatalog()
      .then((data) => {
        if (!alive) return;
        setCatalog(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const trimmed = q.trim();
  const isResults = trimmed.length > 0;

  const results = useMemo(() => {
    if (!catalog || !isResults) return null;
    return filterSearchCatalog(catalog, trimmed);
  }, [catalog, isResults, trimmed]);

  function runChip(term: string) {
    setQ(term);
    setFilter("all");
  }

  function clearQuery() {
    setQ("");
    setFilter("all");
  }

  const showCreators =
    !isResults || filter === "all" || filter === "creators";
  const showPacks = !isResults || filter === "all" || filter === "packs";

  const resultCreators = results?.creators ?? [];
  const resultPacks = results?.packs ?? [];
  const visibleCreators = filter === "packs" ? [] : resultCreators;
  const visiblePacks = filter === "creators" ? [] : resultPacks;
  const visibleTotal = visibleCreators.length + visiblePacks.length;

  const bodyKey = isResults
    ? `results:${trimmed.toLowerCase()}:${filter}`
    : status === "error"
      ? "error"
      : "discover";

  return (
    <section
      data-page-scroll
      className="search-page relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
      aria-label="Search"
    >
      <div className="search-page-inner mx-auto w-full max-w-[75rem] px-4 pt-3 sm:px-6 lg:px-8">
        <motion.div
          className="search-bar-row"
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={BAR_ITEM}
        >
          <label className="search-bar" htmlFor={inputId}>
            <Search className="search-bar-icon" aria-hidden="true" />
            <input
              id={inputId}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="search-bar-input"
              placeholder="Search creators and packs..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q ? (
              <button
                type="button"
                className="search-bar-clear"
                aria-label="Clear search"
                onClick={clearQuery}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            className="search-cancel"
            aria-label="Close"
            onClick={onCancel}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </motion.div>

        <motion.div
          key={bodyKey}
          className="search-body"
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={bodyStagger}
          aria-busy={status === "loading" || (status === "ready" && !isResults)}
        >
          {status === "error" ? (
            <SearchReveal className="search-empty">
              <p className="search-empty-title">Couldn&apos;t load search</p>
              <p className="search-empty-sub">
                Check your connection, then try again.
              </p>
              <button
                type="button"
                className="search-empty-cta"
                onClick={() => {
                  setStatus("loading");
                  setCatalog(null);
                  void loadSearchCatalog()
                    .then((data) => {
                      setCatalog(data);
                      setStatus("ready");
                    })
                    .catch(() => setStatus("error"));
                }}
              >
                Retry
              </button>
            </SearchReveal>
          ) : null}

          {status !== "error" && !isResults ? (
            <DefaultDiscovery
              catalog={catalog}
              onChip={runChip}
              onOpenCreator={onOpenCreator}
              onOpenPack={onOpenPack}
            />
          ) : null}

          {catalog && isResults && results ? (
            <>
              <SearchReveal className="search-results-header">
                <p className="search-results-query">
                  Search results for &ldquo;{results.query}&rdquo;
                </p>
                <p className="search-results-count">
                  {visibleTotal} result{visibleTotal === 1 ? "" : "s"}
                </p>
              </SearchReveal>

              <SearchReveal
                className="search-filters"
                aria-label="Content type"
              >
                {(
                  [
                    ["all", "All"],
                    ["creators", "Creators"],
                    ["packs", "Packs"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={filter === id}
                    className={[
                      "search-filter-chip",
                      filter === id ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </SearchReveal>

              {visibleTotal === 0 ? (
                <EmptyResults
                  query={results.query}
                  onClear={clearQuery}
                  catalog={catalog}
                  onOpenCreator={onOpenCreator}
                  onOpenPack={onOpenPack}
                />
              ) : (
                <>
                  {showCreators && visibleCreators.length > 0 ? (
                    <SearchReveal
                      as="section"
                      className="search-section"
                      aria-labelledby="search-creators-h"
                    >
                      <div className="search-section-header">
                        <h2
                          id="search-creators-h"
                          className="search-section-title"
                        >
                          Creators ({visibleCreators.length})
                        </h2>
                      </div>
                      <ul className="search-creator-list">
                        {visibleCreators.map((creator) => (
                          <li key={creator.id}>
                            <CreatorResultRow
                              creator={creator}
                              onOpen={() => onOpenCreator(creator.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </SearchReveal>
                  ) : null}

                  {showPacks && visiblePacks.length > 0 ? (
                    <SearchReveal
                      as="section"
                      className="search-section"
                      aria-labelledby="search-packs-h"
                    >
                      <div className="search-section-header">
                        <h2
                          id="search-packs-h"
                          className="search-section-title"
                        >
                          Packs ({visiblePacks.length})
                        </h2>
                      </div>
                      <div className="search-pack-grid">
                        {visiblePacks.map((pack) => (
                          <PackCard
                            key={pack.id}
                            pack={pack}
                            onOpen={() => onOpenPack(pack)}
                          />
                        ))}
                      </div>
                    </SearchReveal>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

const SKELETON_CHIP_WIDTHS = [88, 118, 96, 132, 84, 110, 102];
const SKELETON_CREATOR_COUNT = 6;
const SKELETON_PACK_COUNT = 4;
const MEDIA_READY_TIMEOUT_MS = 8000;
const CONTENT_FADE_MS = 360;
const CONTENT_STAGGER_MS = 140;
const CONTENT_FADE_OUT_MS =
  CONTENT_FADE_MS + CONTENT_STAGGER_MS * 2 + 80;

function discoveryMediaIds(catalog: SearchCatalog) {
  const ids: string[] = [];
  for (const creator of catalog.popularCreators) {
    if (creator.avatarUrl.trim()) ids.push(`creator:${creator.id}`);
  }
  for (const pack of catalog.trendingPacks) {
    if (pack.coverImageUrl.trim()) ids.push(`pack:${pack.id}`);
  }
  return ids;
}

function SkeletonBar({
  className,
  width,
  height,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
}) {
  return (
    <span
      className={["search-skeleton", className].filter(Boolean).join(" ")}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

function SearchSectionHeader({
  id,
  title,
  scroll,
  prevLabel,
  nextLabel,
}: {
  id: string;
  title: ReactNode;
  scroll?: ReturnType<typeof useHorizontalScroll>;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="search-section-header">
      <h2 id={id} className="search-section-title">
        {title}
      </h2>
      {scroll ? (
        <div className="ready-reveal-group-arrows">
          <button
            type="button"
            className="continue-collecting-arrow is-prev"
            aria-label={prevLabel ?? "Previous"}
            disabled={!scroll.canScrollLeft}
            onClick={() => scroll.scrollByPage(-1)}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="continue-collecting-arrow is-next"
            aria-label={nextLabel ?? "Next"}
            disabled={!scroll.canScrollRight}
            onClick={() => scroll.scrollByPage(1)}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonChips() {
  return (
    <section className="search-section" aria-label="Trending searches">
      <SearchSectionHeader
        id="search-trending-skeleton-h"
        title={<SkeletonBar className="search-skeleton-title" width={148} />}
      />
      <div className="search-chips">
        {SKELETON_CHIP_WIDTHS.map((width) => (
          <SkeletonBar
            key={width}
            className="search-chip search-chip--skeleton"
            width={width}
          />
        ))}
      </div>
    </section>
  );
}

function SkeletonCreators() {
  return (
    <section className="search-section" aria-label="Popular creators">
      <SearchSectionHeader
        id="search-popular-skeleton-h"
        title={<SkeletonBar className="search-skeleton-title" width={156} />}
      />
      <div className="search-creator-scroll">
        {Array.from({ length: SKELETON_CREATOR_COUNT }, (_, index) => (
          <span key={index} className="search-creator-tile is-skeleton">
            <SkeletonBar
              className="search-creator-avatar"
              width={72}
              height={72}
            />
            <SkeletonBar className="search-skeleton-line" width={64} height={10} />
          </span>
        ))}
      </div>
    </section>
  );
}

function SkeletonPacks() {
  return (
    <section className="search-section" aria-label="Trending packs">
      <SearchSectionHeader
        id="search-packs-trend-skeleton-h"
        title={<SkeletonBar className="search-skeleton-title" width={132} />}
      />
      <div className="search-pack-scroll">
        {Array.from({ length: SKELETON_PACK_COUNT }, (_, index) => (
          <span key={index} className="search-pack-card is-wide is-skeleton">
            <SkeletonBar className="search-pack-art" />
            <span className="search-pack-meta">
              <SkeletonBar className="search-skeleton-line" width="72%" height={14} />
              <SkeletonBar className="search-skeleton-line" width="48%" height={12} />
              <span className="search-pack-footer">
                <SkeletonBar className="search-skeleton-line" width={92} height={12} />
                <SkeletonBar className="search-skeleton-line" width={36} height={12} />
              </span>
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function DiscoverySlot({
  delayMs,
  ready,
  skeleton,
  children,
}: {
  delayMs: number;
  ready: boolean;
  skeleton: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SearchReveal
      className={["search-slot", ready ? "is-ready" : ""].filter(Boolean).join(" ")}
      style={{ ["--search-reveal-delay" as string]: `${delayMs}ms` }}
    >
      {skeleton ? (
        <div className="search-slot-skeleton" aria-hidden={ready}>
          {skeleton}
        </div>
      ) : null}
      {children ? <div className="search-slot-real">{children}</div> : null}
    </SearchReveal>
  );
}

function DefaultDiscovery({
  catalog,
  onChip,
  onOpenCreator,
  onOpenPack,
}: {
  catalog: SearchCatalog | null;
  onChip: (term: string) => void;
  onOpenCreator: (id: string) => void;
  onOpenPack: (pack: SearchPack) => void;
}) {
  const chips = catalog?.trendingChips ?? [];
  const creators = catalog?.popularCreators ?? [];
  const packs = catalog?.trendingPacks ?? [];
  const pendingIds = useRef(new Set<string>());
  const [mediaReady, setMediaReady] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (!catalog) {
      pendingIds.current = new Set();
      setMediaReady(false);
      return;
    }
    const ids = discoveryMediaIds(catalog);
    pendingIds.current = new Set(ids);
    if (ids.length === 0) {
      setMediaReady(true);
      return;
    }
    setMediaReady(false);
    const timeout = window.setTimeout(() => setMediaReady(true), MEDIA_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [catalog]);

  const onMediaReady = useCallback((id: string) => {
    if (!pendingIds.current.has(id)) return;
    pendingIds.current.delete(id);
    if (pendingIds.current.size === 0) setMediaReady(true);
  }, []);

  const showLoaded = Boolean(catalog) && mediaReady;

  useEffect(() => {
    if (!showLoaded) {
      setShowSkeleton(true);
      return;
    }
    const fade = window.setTimeout(() => setShowSkeleton(false), CONTENT_FADE_OUT_MS);
    return () => window.clearTimeout(fade);
  }, [showLoaded]);

  const scrollRevision = showLoaded ? 1 : 0;
  const creatorsScroll = useHorizontalScroll(
    ".search-creator-tile",
    scrollRevision,
  );
  const packsScroll = useHorizontalScroll(".search-pack-card", scrollRevision);

  useEffect(() => {
    if (!showLoaded) return;
    const measure = () => {
      creatorsScroll.updateScrollState();
      packsScroll.updateScrollState();
    };
    const raf = window.requestAnimationFrame(measure);
    const later = window.setTimeout(measure, CONTENT_FADE_MS + 40);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(later);
    };
  }, [creatorsScroll, packsScroll, showLoaded]);

  const showChips = chips.length > 0;
  const showCreators = creators.length > 0;
  const showPacks = packs.length > 0;

  return (
    <>
      <DiscoverySlot
        delayMs={0}
        ready={showLoaded}
        skeleton={showSkeleton ? <SkeletonChips /> : null}
      >
        {catalog && showChips ? (
          <section className="search-section" aria-labelledby="search-trending-h">
            <SearchSectionHeader
              id="search-trending-h"
              title="Trending searches"
            />
            <div className="search-chips">
              {chips.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="search-chip"
                  onClick={() => onChip(term)}
                  tabIndex={showLoaded ? undefined : -1}
                >
                  {term}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </DiscoverySlot>

      <DiscoverySlot
        delayMs={CONTENT_STAGGER_MS}
        ready={showLoaded}
        skeleton={showSkeleton ? <SkeletonCreators /> : null}
      >
        {catalog && showCreators ? (
          <section className="search-section" aria-labelledby="search-popular-h">
            <SearchSectionHeader
              id="search-popular-h"
              title="Popular creators"
              scroll={showLoaded ? creatorsScroll : undefined}
              prevLabel="Previous creators"
              nextLabel="Next creators"
            />
            <div ref={creatorsScroll.scrollRef} className="search-creator-scroll">
              {creators.map((creator) => (
                <button
                  key={creator.id}
                  type="button"
                  className="search-creator-tile"
                  onClick={() => onOpenCreator(creator.id)}
                  tabIndex={showLoaded ? undefined : -1}
                >
                  <CreatorAvatar
                    creator={creator}
                    size={72}
                    onReady={() => onMediaReady(`creator:${creator.id}`)}
                  />
                  <span className="search-creator-tile-name">{creator.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </DiscoverySlot>

      <DiscoverySlot
        delayMs={CONTENT_STAGGER_MS * 2}
        ready={showLoaded}
        skeleton={showSkeleton ? <SkeletonPacks /> : null}
      >
        {catalog && showPacks ? (
          <section className="search-section" aria-labelledby="search-packs-trend-h">
            <SearchSectionHeader
              id="search-packs-trend-h"
              title="Trending packs"
              scroll={showLoaded ? packsScroll : undefined}
              prevLabel="Previous packs"
              nextLabel="Next packs"
            />
            <div ref={packsScroll.scrollRef} className="search-pack-scroll">
              {packs.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  wide
                  onOpen={() => onOpenPack(pack)}
                  onArtReady={() => onMediaReady(`pack:${pack.id}`)}
                  inert={!showLoaded}
                />
              ))}
            </div>
          </section>
        ) : null}
      </DiscoverySlot>

      {showLoaded && !showChips && !showCreators && !showPacks ? (
        <SearchReveal className="search-empty">
          <p className="search-empty-title">Nothing to explore yet</p>
          <p className="search-empty-sub">
            Check back soon — creators and packs will show up here.
          </p>
        </SearchReveal>
      ) : null}
    </>
  );
}

function EmptyResults({
  query,
  onClear,
  catalog,
  onOpenCreator,
  onOpenPack,
}: {
  query: string;
  onClear: () => void;
  catalog: SearchCatalog;
  onOpenCreator: (id: string) => void;
  onOpenPack: (pack: SearchPack) => void;
}) {
  const suggestCreators = catalog.popularCreators.slice(0, 6);
  const suggestPacks = catalog.trendingPacks.slice(0, 4);
  const creatorsScroll = useHorizontalScroll(
    ".search-creator-tile",
    suggestCreators.length,
  );
  const packsScroll = useHorizontalScroll(
    ".search-pack-card",
    suggestPacks.length,
  );
  return (
    <>
      <SearchReveal className="search-empty">
        <p className="search-empty-title">
          No results for &ldquo;{query}&rdquo;
        </p>
        <p className="search-empty-sub">
          Try searching for a creator, pack, card, or theme.
        </p>
        <button type="button" className="search-empty-cta" onClick={onClear}>
          Clear search
        </button>
      </SearchReveal>

      {suggestCreators.length > 0 ? (
        <SearchReveal
          as="section"
          className="search-section"
          aria-labelledby="search-like-creators-h"
        >
          <SearchSectionHeader
            id="search-like-creators-h"
            title="You might like"
            scroll={creatorsScroll}
            prevLabel="Previous creators"
            nextLabel="Next creators"
          />
          <div ref={creatorsScroll.scrollRef} className="search-creator-scroll">
            {suggestCreators.map((creator) => (
              <button
                key={creator.id}
                type="button"
                className="search-creator-tile"
                onClick={() => onOpenCreator(creator.id)}
              >
                <CreatorAvatar creator={creator} size={56} />
                <span className="search-creator-tile-name">{creator.name}</span>
              </button>
            ))}
          </div>
        </SearchReveal>
      ) : null}

      {suggestPacks.length > 0 ? (
        <SearchReveal
          as="section"
          className="search-section"
          aria-labelledby="search-like-packs-h"
        >
          <SearchSectionHeader
            id="search-like-packs-h"
            title={
              suggestCreators.length > 0 ? "Trending packs" : "You might like"
            }
            scroll={packsScroll}
            prevLabel="Previous packs"
            nextLabel="Next packs"
          />
          <div ref={packsScroll.scrollRef} className="search-pack-scroll">
            {suggestPacks.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                wide
                onOpen={() => onOpenPack(pack)}
              />
            ))}
          </div>
        </SearchReveal>
      ) : null}
    </>
  );
}

function CreatorAvatar({
  creator,
  size,
  onReady,
}: {
  creator: SearchCreator;
  size: number;
  onReady?: () => void;
}) {
  const src = creator.avatarUrl.trim();
  return (
    <span
      className="search-creator-avatar"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          onLoad={onReady}
          onError={onReady}
          ref={(node) => {
            if (!node || !onReady) return;
            if (node.complete) onReady();
          }}
        />
      ) : (
        <span className="search-creator-avatar-fallback" aria-hidden="true">
          {creator.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function CreatorResultRow({
  creator,
  onOpen,
}: {
  creator: SearchCreator;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="search-creator-row" onClick={onOpen}>
      <CreatorAvatar creator={creator} size={48} />
      <span className="search-creator-row-meta">
        <span className="search-creator-row-name">{creator.name}</span>
        <span className="search-creator-row-handle">@{creator.username}</span>
      </span>
      <ChevronRight className="search-creator-row-chevron" aria-hidden="true" />
    </button>
  );
}

function PackCard({
  pack,
  onOpen,
  wide = false,
  onArtReady,
  inert = false,
}: {
  pack: SearchPack;
  onOpen: () => void;
  wide?: boolean;
  onArtReady?: () => void;
  inert?: boolean;
}) {
  const art = pack.coverImageUrl?.trim() ?? "";
  const markReady = onArtReady
    ? (_event?: SyntheticEvent) => onArtReady()
    : undefined;
  return (
    <button
      type="button"
      className={["search-pack-card", wide ? "is-wide" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onOpen}
      tabIndex={inert ? -1 : undefined}
    >
      <span className="search-pack-art">
        {art ? (
          isVideoSrc(art) ? (
            <video
              src={art}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              aria-hidden="true"
              onLoadedData={markReady}
              onCanPlay={markReady}
              onError={markReady}
              ref={(node) => {
                if (!node || !onArtReady) return;
                if (node.readyState >= 2) onArtReady();
              }}
            />
          ) : (
            <img
              src={art}
              alt=""
              loading="eager"
              decoding="async"
              onLoad={markReady}
              onError={markReady}
              ref={(node) => {
                if (!node || !onArtReady) return;
                if (node.complete) onArtReady();
              }}
            />
          )
        ) : null}
      </span>
      <span className="search-pack-meta">
        <span className="search-pack-name">{pack.name}</span>
        <span className="search-pack-by">by {pack.creatorName}</span>
        <div className="search-pack-footer">
          <div className="search-pack-cards">
            {pack.cardCount} Motion Card{pack.cardCount === 1 ? "" : "s"}
          </div>
          <span
            className="search-pack-price"
            aria-label={`${pack.diamondCost} Diamonds`}
          >
            <DiamondLottie
              className="search-pack-diamond shrink-0"
              size={14}
              aria-hidden
            />
            <span className="tabular-nums">{pack.diamondCost}</span>
          </span>
        </div>
      </span>
    </button>
  );
}
