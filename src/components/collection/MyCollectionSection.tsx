import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  liveCollectedCount,
  MyCollectionLivePanel,
  useCreatorsCollectedThemes,
} from "@/components/collection/MyCollectionLivePanel";
import type { CreatorProgress } from "@/services/collection";

type SortId = "newest" | "oldest";
type FilterMenu = "creator" | "theme" | "sort" | null;

const SORT_OPTIONS: Array<{ id: SortId; label: string }> = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
];

/**
 * My Collection — permanent browsing for already revealed cards.
 * Creator list from local ledger; themes + card previews from live /api/collection.
 */
export function MyCollectionSection({
  creators,
  hasPendingReveal = false,
  onOpenCreator,
  onExplorePacks,
  onFocusReadyToReveal,
}: {
  creators: CreatorProgress[];
  hasPendingReveal?: boolean;
  onOpenCreator: (creatorId: string, themeId?: string) => void;
  onExplorePacks?: () => void;
  onFocusReadyToReveal?: () => void;
}) {
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    null,
  );
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<FilterMenu>(null);

  const creatorIds = useMemo(() => creators.map((c) => c.id), [creators]);
  const { themesByCreator } = useCreatorsCollectedThemes(creatorIds);

  const sortedCreators = useMemo(() => {
    if (sort === "oldest") {
      return [...creators].reverse();
    }
    // Newest first — creators already arrive newest-first from the ledger.
    return creators;
  }, [creators, sort]);

  const filteredCreators = useMemo(() => {
    if (creatorFilter === "all") return sortedCreators;
    return sortedCreators.filter((creator) => creator.id === creatorFilter);
  }, [sortedCreators, creatorFilter]);

  const themeOptions = useMemo(() => {
    const scopeIds =
      creatorFilter === "all"
        ? filteredCreators.map((c) => c.id)
        : [creatorFilter];
    const byId = new Map<string, string>();
    for (const creatorId of scopeIds) {
      for (const theme of themesByCreator[creatorId] ?? []) {
        byId.set(theme.id, theme.name);
      }
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [filteredCreators, creatorFilter, themesByCreator]);

  const visibleCreators = useMemo(() => {
    if (themeFilter === "all") return filteredCreators;
    return filteredCreators.filter((creator) =>
      (themesByCreator[creator.id] ?? []).some(
        (theme) => theme.id === themeFilter,
      ),
    );
  }, [filteredCreators, themeFilter, themesByCreator]);

  useEffect(() => {
    if (visibleCreators.length === 0) {
      setSelectedCreatorId(null);
      return;
    }
    if (
      !selectedCreatorId ||
      !visibleCreators.some((c) => c.id === selectedCreatorId)
    ) {
      setSelectedCreatorId(visibleCreators[0]!.id);
    }
  }, [visibleCreators, selectedCreatorId]);

  const selectedCreator =
    visibleCreators.find((c) => c.id === selectedCreatorId) ??
    visibleCreators[0] ??
    null;

  const onSelectThemeId = useCallback((themeId: string | null) => {
    setSelectedThemeId(themeId);
  }, []);

  const creatorFilterLabel =
    creatorFilter === "all"
      ? "All Creators"
      : (creators.find((c) => c.id === creatorFilter)?.name ?? "All Creators");
  const themeFilterLabel =
    themeFilter === "all"
      ? "All Themes"
      : (themeOptions.find((t) => t.id === themeFilter)?.name ?? "All Themes");
  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "Newest first";

  const filtersActive = creatorFilter !== "all" || themeFilter !== "all";

  function clearFilters() {
    setCreatorFilter("all");
    setThemeFilter("all");
    setOpenMenu(null);
  }

  function openCreatorCollection(themeId?: string | null) {
    if (!selectedCreator) return;
    onOpenCreator(selectedCreator.id, themeId ?? undefined);
  }

  if (creators.length === 0) {
    return (
      <section
        id="my-collection"
        className="collection-section my-collection"
        aria-labelledby="my-collection-heading"
      >
        <div className="my-collection-head">
          <div className="my-collection-intro">
            <h2 id="my-collection-heading" className="collection-section-title">
              My Collection
            </h2>
          </div>
        </div>
        <div className="collection-empty-panel">
          <h3 className="collection-empty-title">Your collection starts here</h3>
          <p className="collection-empty-copy">
            Cards you reveal will appear here.
          </p>
          {hasPendingReveal ? (
            <button
              type="button"
              className="collection-snapshot-cta"
              onClick={onFocusReadyToReveal}
            >
              Go to Ready to Reveal
            </button>
          ) : (
            <button
              type="button"
              className="collection-snapshot-cta"
              onClick={onExplorePacks}
            >
              Explore
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      id="my-collection"
      className="collection-section my-collection"
      aria-labelledby="my-collection-heading"
    >
      <div className="my-collection-head">
        <div className="my-collection-intro">
          <h2 id="my-collection-heading" className="collection-section-title">
            My Collection
          </h2>
        </div>

        <div className="my-collection-filters" role="group" aria-label="Filters">
          <FilterButton
            label={creatorFilterLabel}
            open={openMenu === "creator"}
            active={creatorFilter !== "all"}
            onToggle={() =>
              setOpenMenu((m) => (m === "creator" ? null : "creator"))
            }
          />
          <FilterButton
            label={themeFilterLabel}
            open={openMenu === "theme"}
            active={themeFilter !== "all"}
            onToggle={() =>
              setOpenMenu((m) => (m === "theme" ? null : "theme"))
            }
          />
          <FilterButton
            label={sortLabel}
            open={openMenu === "sort"}
            active={sort !== "newest"}
            onToggle={() => setOpenMenu((m) => (m === "sort" ? null : "sort"))}
          />
        </div>
      </div>

      {openMenu ? (
        <FilterSheet
          title={
            openMenu === "creator"
              ? "Creators"
              : openMenu === "theme"
                ? "Themes"
                : "Sort"
          }
          onClose={() => setOpenMenu(null)}
        >
          {openMenu === "creator" ? (
            <>
              <FilterOption
                label="All Creators"
                selected={creatorFilter === "all"}
                onSelect={() => {
                  setCreatorFilter("all");
                  setThemeFilter("all");
                  setOpenMenu(null);
                }}
              />
              {creators.map((creator) => (
                <FilterOption
                  key={creator.id}
                  label={creator.name}
                  selected={creatorFilter === creator.id}
                  onSelect={() => {
                    setCreatorFilter(creator.id);
                    setSelectedCreatorId(creator.id);
                    setThemeFilter("all");
                    setOpenMenu(null);
                  }}
                />
              ))}
            </>
          ) : null}
          {openMenu === "theme" ? (
            <>
              <FilterOption
                label="All Themes"
                selected={themeFilter === "all"}
                onSelect={() => {
                  setThemeFilter("all");
                  setOpenMenu(null);
                }}
              />
              {themeOptions.map((theme) => (
                <FilterOption
                  key={theme.id}
                  label={theme.name}
                  selected={themeFilter === theme.id}
                  onSelect={() => {
                    setThemeFilter(theme.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
            </>
          ) : null}
          {openMenu === "sort"
            ? SORT_OPTIONS.map((option) => (
                <FilterOption
                  key={option.id}
                  label={option.label}
                  selected={sort === option.id}
                  onSelect={() => {
                    setSort(option.id);
                    setOpenMenu(null);
                  }}
                />
              ))
            : null}
        </FilterSheet>
      ) : null}

      {visibleCreators.length === 0 ? (
        <div className="collection-empty-panel">
          <h3 className="collection-empty-title">No collections found</h3>
          <p className="collection-empty-copy">
            Try another Creator or Theme.
          </p>
          {filtersActive ? (
            <button
              type="button"
              className="collection-snapshot-cta"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className="my-collection-creator-row"
            role="listbox"
            aria-label="Creators"
          >
            {visibleCreators.map((creator) => {
              const selected = creator.id === selectedCreator?.id;
              const count = liveCollectedCount(
                themesByCreator[creator.id],
                creator.collected,
              );
              return (
                <button
                  key={creator.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={[
                    "my-collection-creator-card",
                    selected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setSelectedCreatorId(creator.id);
                    if (
                      creatorFilter !== "all" &&
                      creatorFilter !== creator.id
                    ) {
                      setCreatorFilter(creator.id);
                    }
                  }}
                >
                  <span className="my-collection-creator-art">
                    <img
                      src={creator.coverUrl || creator.avatarUrl}
                      alt=""
                    />
                  </span>
                  <span className="my-collection-creator-meta">
                    <span className="my-collection-creator-name">
                      {creator.name}
                    </span>
                    <span className="my-collection-creator-count">
                      {count} {count === 1 ? "Card" : "Cards"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedCreator ? (
            <MyCollectionLivePanel
              key={selectedCreator.id}
              creator={selectedCreator}
              themeFilter={themeFilter}
              selectedThemeId={selectedThemeId}
              onSelectThemeId={onSelectThemeId}
              onOpenCollection={openCreatorCollection}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function FilterButton({
  label,
  open,
  active = false,
  onToggle,
}: {
  label: string;
  open: boolean;
  active?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "my-collection-filter-btn",
        open ? "is-open" : "",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-expanded={open}
      onClick={onToggle}
    >
      <span>{label}</span>
      <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

function FilterSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="my-collection-filter-overlay" role="presentation">
      <button
        type="button"
        className="my-collection-filter-backdrop"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div
        className="my-collection-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <p className="my-collection-filter-title">{title}</p>
        <ul className="my-collection-filter-list">{children}</ul>
      </div>
    </div>
  );
}

function FilterOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={[
          "my-collection-filter-option",
          selected ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span
          className={[
            "my-collection-filter-radio",
            selected ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        />
        {label}
      </button>
    </li>
  );
}
