import { useEffect, useId, useMemo, useState } from "react";
import { Search, X, ChevronRight } from "lucide-react";
import { useMarkPageReady } from "@/shared/ui/PageTransition";
import {
  filterSearchCatalog,
  loadSearchCatalog,
  type SearchCatalog,
  type SearchCreator,
  type SearchFilter,
  type SearchPack,
} from "@/services/search";
import { DiamondLottie } from "@/components/ui/DiamondLottie";

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
  const [catalog, setCatalog] = useState<SearchCatalog | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");

  useMarkPageReady(status !== "loading");

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
  const visibleCreators =
    filter === "packs" ? [] : resultCreators;
  const visiblePacks = filter === "creators" ? [] : resultPacks;
  const visibleTotal = visibleCreators.length + visiblePacks.length;

  return (
    <section
      data-page-scroll
      className="search-page relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-diamond-offset)] pb-[var(--app-footer-offset)] lg:pb-12"
      aria-label="Search"
    >
      <div className="search-page-inner mx-auto w-full max-w-[75rem] px-4 pt-3 sm:px-6 lg:px-8">
        <div className="search-bar-row">
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
          <button type="button" className="search-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>

        {status === "loading" ? (
          <div className="search-loading" aria-hidden="true">
            <div className="search-skeleton-chips" />
            <div className="search-skeleton-row" />
            <div className="search-skeleton-row" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="search-empty">
            <p className="search-empty-title">Couldn&apos;t load search</p>
            <p className="search-empty-sub">Check your connection, then try again.</p>
            <button
              type="button"
              className="search-empty-cta"
              onClick={() => {
                setStatus("loading");
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
          </div>
        ) : null}

        {status === "ready" && catalog && !isResults ? (
          <DefaultDiscovery
            catalog={catalog}
            onChip={runChip}
            onOpenCreator={onOpenCreator}
            onOpenPack={onOpenPack}
          />
        ) : null}

        {status === "ready" && catalog && isResults && results ? (
          <div className="search-results">
            <div className="search-results-header">
              <p className="search-results-query">
                Search results for &ldquo;{results.query}&rdquo;
              </p>
              <p className="search-results-count">
                {visibleTotal} result{visibleTotal === 1 ? "" : "s"}
              </p>
            </div>

            <div className="search-filters" aria-label="Content type">
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
            </div>

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
                  <section className="search-section" aria-labelledby="search-creators-h">
                    <div className="search-section-header">
                      <h2 id="search-creators-h" className="search-section-title">
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
                  </section>
                ) : null}

                {showPacks && visiblePacks.length > 0 ? (
                  <section className="search-section" aria-labelledby="search-packs-h">
                    <div className="search-section-header">
                      <h2 id="search-packs-h" className="search-section-title">
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
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DefaultDiscovery({
  catalog,
  onChip,
  onOpenCreator,
  onOpenPack,
}: {
  catalog: SearchCatalog;
  onChip: (term: string) => void;
  onOpenCreator: (id: string) => void;
  onOpenPack: (pack: SearchPack) => void;
}) {
  return (
    <div className="search-default">
      {catalog.trendingChips.length > 0 ? (
        <section className="search-section" aria-labelledby="search-trending-h">
          <div className="search-section-header">
            <h2 id="search-trending-h" className="search-section-title">
              Trending searches
            </h2>
          </div>
          <div className="search-chips">
            {catalog.trendingChips.map((term) => (
              <button
                key={term}
                type="button"
                className="search-chip"
                onClick={() => onChip(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {catalog.popularCreators.length > 0 ? (
        <section className="search-section" aria-labelledby="search-popular-h">
          <div className="search-section-header">
            <h2 id="search-popular-h" className="search-section-title">
              Popular creators
            </h2>
          </div>
          <div className="search-creator-scroll">
            {catalog.popularCreators.map((creator) => (
              <button
                key={creator.id}
                type="button"
                className="search-creator-tile"
                onClick={() => onOpenCreator(creator.id)}
              >
                <CreatorAvatar creator={creator} size={72} />
                <span className="search-creator-tile-name">{creator.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {catalog.trendingPacks.length > 0 ? (
        <section className="search-section" aria-labelledby="search-packs-trend-h">
          <div className="search-section-header">
            <h2 id="search-packs-trend-h" className="search-section-title">
              Trending packs
            </h2>
          </div>
          <div className="search-pack-scroll">
            {catalog.trendingPacks.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                wide
                onOpen={() => onOpenPack(pack)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!catalog.trendingChips.length &&
      !catalog.popularCreators.length &&
      !catalog.trendingPacks.length ? (
        <div className="search-empty">
          <p className="search-empty-title">Nothing to explore yet</p>
          <p className="search-empty-sub">
            Check back soon — creators and packs will show up here.
          </p>
        </div>
      ) : null}
    </div>
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
  return (
    <div className="search-empty">
      <p className="search-empty-title">No results for &ldquo;{query}&rdquo;</p>
      <p className="search-empty-sub">
        Try searching for a creator, pack, card, or theme.
      </p>
      <button type="button" className="search-empty-cta" onClick={onClear}>
        Clear search
      </button>

      {(catalog.popularCreators.length > 0 ||
        catalog.trendingPacks.length > 0) && (
        <div className="search-might-like">
          <h3 className="search-section-title">You might like</h3>
          {catalog.popularCreators.length > 0 ? (
            <div className="search-creator-scroll">
              {catalog.popularCreators.slice(0, 6).map((creator) => (
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
          ) : null}
          {catalog.trendingPacks.length > 0 ? (
            <div className="search-pack-scroll">
              {catalog.trendingPacks.slice(0, 4).map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  wide
                  onOpen={() => onOpenPack(pack)}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CreatorAvatar({
  creator,
  size,
}: {
  creator: SearchCreator;
  size: number;
}) {
  return (
    <span
      className="search-creator-avatar"
      style={{ width: size, height: size }}
    >
      {creator.avatarUrl ? (
        <img src={creator.avatarUrl} alt="" loading="lazy" />
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
}: {
  pack: SearchPack;
  onOpen: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={["search-pack-card", wide ? "is-wide" : ""].filter(Boolean).join(" ")}
      onClick={onOpen}
    >
      <span className="search-pack-art">
        {pack.coverImageUrl ? (
          <img src={pack.coverImageUrl} alt="" loading="lazy" />
        ) : null}
      </span>
      <span className="search-pack-meta">
        <span className="search-pack-name">{pack.name}</span>
        <span className="search-pack-by">by {pack.creatorName}</span>
        <span className="search-pack-footer">
          <span>
            {pack.cardCount > 0 ? `${pack.cardCount} Cards` : pack.themeName}
          </span>
          <span className="search-pack-price">
            <DiamondLottie className="search-pack-diamond" size={14} aria-hidden />
            {pack.diamondCost} SC
          </span>
        </span>
      </span>
    </button>
  );
}
