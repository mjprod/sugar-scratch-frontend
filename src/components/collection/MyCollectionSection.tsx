import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Images,
  Layers,
  Search,
  Sparkles,
} from "lucide-react";
import {
  liveCollectedCount,
  useCreatorsCollectedThemes,
} from "@/components/collection/MyCollectionLivePanel";
import { useSearch } from "@/contexts/SearchContext";
import { useModels } from "@/hooks/useModels";
import type { CreatorProgress } from "@/services/collection";
import {
  matchModel,
  modelAvatarUrl,
  modelDisplayName,
  modelId,
  type BackendModel,
} from "@/services/models";

type SortId = "newest" | "oldest" | "progress";
type FilterMenu = "creator" | "sort" | null;

const SORT_OPTIONS: Array<{ id: SortId; label: string }> = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "progress", label: "Most complete" },
];

function locationLabel(model: BackendModel | null | undefined): string {
  if (!model) return "";
  const city = model.influencerCity?.trim() || "";
  const country = model.influencerCountry?.trim() || "";
  if (city && country) return `${city}, ${country}`;
  return city || country || "";
}

function isApiMediaUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (value.startsWith("/models/") || value.startsWith("/cards/")) return true;
  if (value.startsWith("/photo-scratch/") || value.startsWith("/api/")) return true;
  // Absolute same-origin media from the media host/proxy.
  try {
    if (/^https?:\/\//i.test(value)) {
      const path = new URL(value).pathname;
      return (
        path.startsWith("/models/") ||
        path.startsWith("/cards/") ||
        path.startsWith("/photo-scratch/")
      );
    }
  } catch {
    /* ignore */
  }
  return false;
}

function apiModelAvatar(creatorId: string): string {
  const slug = creatorId
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  return slug ? `/models/${slug}/avatar.jpeg` : "";
}

function avatarFor(
  creator: CreatorProgress,
  model: BackendModel | null | undefined,
): string {
  const fromModel = modelAvatarUrl(model) || "";
  if (isApiMediaUrl(fromModel)) return fromModel;

  const fromCreator = (creator.avatarUrl || creator.coverUrl || "").trim();
  if (isApiMediaUrl(fromCreator)) return fromCreator;

  // Prefer stable model id path, then creator id — never fixture placeholders.
  const modelSlug = model ? modelId(model) : "";
  return apiModelAvatar(modelSlug) || apiModelAvatar(creator.id);
}

/**
 * Figma MyCollection "Choose a Model" block (node 206:699):
 * popular creators strip + filters + vertical model progress cards.
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
  const { openSearch } = useSearch();
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [openMenu, setOpenMenu] = useState<FilterMenu>(null);
  const models = useModels();

  const creatorIds = useMemo(() => creators.map((c) => c.id), [creators]);
  const { themesByCreator, ready: themesReady } =
    useCreatorsCollectedThemes(creatorIds);

  const modelByCreator = useMemo(() => {
    const map = new Map<string, BackendModel | null>();
    for (const creator of creators) {
      map.set(
        creator.id,
        matchModel(models, { packId: creator.id, name: creator.name }),
      );
    }
    return map;
  }, [creators, models]);

  const popularCreators = useMemo(() => {
    return [...creators]
      .sort((a, b) => b.pct - a.pct || b.collected - a.collected)
      .slice(0, 12);
  }, [creators]);

  const sortedCreators = useMemo(() => {
    const list = [...creators];
    if (sort === "oldest") return list.reverse();
    if (sort === "progress") {
      return list.sort((a, b) => b.pct - a.pct || b.collected - a.collected);
    }
    return list;
  }, [creators, sort]);

  const visibleCreators = useMemo(() => {
    if (creatorFilter === "all") return sortedCreators;
    return sortedCreators.filter((creator) => creator.id === creatorFilter);
  }, [sortedCreators, creatorFilter]);

  const creatorFilterLabel =
    creatorFilter === "all"
      ? "All Creators"
      : (creators.find((c) => c.id === creatorFilter)?.name ?? "All Creators");
  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "Sort By";

  if (creators.length === 0) {
    return (
      <section
        id="my-collection"
        className="mc-models"
        aria-labelledby="my-collection-heading"
      >
        <h2 id="my-collection-heading" className="mc-models-title">
          Choose a Model
        </h2>
        <div className="mc-models-empty">
          <h3 className="collection-empty-title">Your collection starts here</h3>
          <p className="collection-empty-copy">
            Cards you reveal will appear here.
          </p>
          {hasPendingReveal ? (
            <button
              type="button"
              className="mc-continue-empty-cta"
              onClick={onFocusReadyToReveal}
            >
              Go to Ready to Reveal
            </button>
          ) : (
            <button
              type="button"
              className="mc-continue-empty-cta"
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
      className="mc-models"
      aria-labelledby="my-collection-heading"
    >
      <h2 id="my-collection-heading" className="mc-models-title">
        Choose a Model
      </h2>

      <PopularCreatorsStrip
        creators={popularCreators}
        modelByCreator={modelByCreator}
        onOpenCreator={onOpenCreator}
      />

      <div className="mc-models-filters" role="group" aria-label="Filters">
        <div className="mc-models-filter-left">
          <button
            type="button"
            className="mc-models-search"
            aria-label="Search creators"
            onClick={openSearch}
          >
            <Search size={16} strokeWidth={2.2} aria-hidden />
          </button>
          <FilterButton
            label={creatorFilterLabel}
            open={openMenu === "creator"}
            active={creatorFilter !== "all"}
            onToggle={() =>
              setOpenMenu((m) => (m === "creator" ? null : "creator"))
            }
          />
        </div>
        <FilterButton
          label={openMenu === "sort" || sort !== "newest" ? sortLabel : "Sort By"}
          open={openMenu === "sort"}
          active={sort !== "newest"}
          leadingIcon={
            <Layers size={14} strokeWidth={2.2} aria-hidden="true" />
          }
          onToggle={() => setOpenMenu((m) => (m === "sort" ? null : "sort"))}
        />
      </div>

      {openMenu ? (
        <FilterSheet
          title={openMenu === "creator" ? "Creators" : "Sort"}
          onClose={() => setOpenMenu(null)}
        >
          {openMenu === "creator" ? (
            <>
              <FilterOption
                label="All Creators"
                selected={creatorFilter === "all"}
                onSelect={() => {
                  setCreatorFilter("all");
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

      {!themesReady ? (
        <div className="mc-model-list is-skeleton" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="mc-model-card is-skeleton" />
          ))}
        </div>
      ) : visibleCreators.length === 0 ? (
        <div className="mc-models-empty">
          <h3 className="collection-empty-title">No collections found</h3>
          <p className="collection-empty-copy">Try another Creator.</p>
          <button
            type="button"
            className="mc-continue-empty-cta"
            onClick={() => setCreatorFilter("all")}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="mc-model-list" role="list" aria-label="Models">
          {visibleCreators.map((creator) => {
            const model = modelByCreator.get(creator.id) ?? null;
            const count = liveCollectedCount(
              themesByCreator[creator.id],
              creator.collected,
            );
            const total = Math.max(creator.total || 0, count || 0, 1);
            const motionTotal = Math.max(1, creator.themesTotal || 16);
            const motionDone = Math.min(
              motionTotal,
              Math.max(0, creator.themesStarted || 0),
            );
            const pct = Math.max(
              0,
              Math.min(100, Math.round((count / total) * 100) || creator.pct),
            );
            const name =
              (model ? modelDisplayName(model) : "") || creator.name;
            const place = locationLabel(model);

            return (
              <button
                key={creator.id}
                type="button"
                className="mc-model-card"
                role="listitem"
                onClick={() => onOpenCreator(creator.id)}
                aria-label={`${name}, ${count} of ${total} cards`}
              >
                <span className="mc-model-card-glow" aria-hidden="true">
                  <span className="mc-model-card-glow-blob mc-model-card-glow-blob--a" />
                  <span className="mc-model-card-glow-blob mc-model-card-glow-blob--b" />
                </span>
                <span className="mc-model-avatar-wrap">
                  <img
                    src={avatarFor(creator, model)}
                    alt=""
                    className="mc-model-avatar"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="mc-model-body">
                  <span className="mc-model-name">{name}</span>
                  {place ? (
                    <span className="mc-model-place">{place}</span>
                  ) : null}
                  <span className="mc-model-metrics">
                    <span className="mc-model-metric">
                      <Images size={10} strokeWidth={2.4} aria-hidden />
                      {count}/{total}
                    </span>
                    <span className="mc-model-metric">
                      <Layers size={10} strokeWidth={2.4} aria-hidden />
                      {motionDone}/{motionTotal}
                    </span>
                    <span className="mc-model-metric">
                      <Sparkles size={10} strokeWidth={2.4} aria-hidden />
                      0/1
                    </span>
                  </span>
                  <span
                    className="mc-model-progress"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="mc-model-progress-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PopularCreatorsStrip({
  creators,
  modelByCreator,
  onOpenCreator,
}: {
  creators: CreatorProgress[];
  modelByCreator: Map<string, BackendModel | null>;
  onOpenCreator: (creatorId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(max - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [creators, updateScrollState]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".mc-popular-card");
    const styles = window.getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 4;
    const cardWidth = card?.offsetWidth ?? 82;
    const step = cardWidth + gap;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * step * 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  if (!creators.length) return null;

  return (
    <div className="mc-popular" aria-label="Popular creators">
      <div className="mc-popular-head">
        <span className="mc-popular-heart" aria-hidden="true">
          <Heart size={14} fill="currentColor" strokeWidth={0} />
        </span>
        <p className="mc-popular-title">Popular Creators</p>
      </div>

      <div className="mc-popular-scroll-wrap">
        <button
          type="button"
          className="mc-popular-arrow is-prev"
          aria-label="Previous creators"
          disabled={!canScrollLeft}
          onClick={() => scrollByPage(-1)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div ref={scrollRef} className="mc-popular-scroll">
          {creators.map((creator) => {
            const model = modelByCreator.get(creator.id) ?? null;
            const name =
              (model ? modelDisplayName(model) : "") || creator.name;
            return (
              <button
                key={creator.id}
                type="button"
                className="mc-popular-card"
                onClick={() => onOpenCreator(creator.id)}
              >
                <span className="mc-popular-avatar-wrap">
                  <img
                    src={avatarFor(creator, model)}
                    alt=""
                    className="mc-popular-avatar"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="mc-popular-name">{name}</span>
                <span className="mc-popular-sub">
                  {creator.pct > 0 ? `${creator.pct}% complete` : "Joined recently"}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mc-popular-arrow is-next"
          aria-label="Next creators"
          disabled={!canScrollRight}
          onClick={() => scrollByPage(1)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function FilterButton({
  label,
  open,
  active = false,
  onToggle,
  leadingIcon,
}: {
  label: string;
  open: boolean;
  active?: boolean;
  onToggle: () => void;
  leadingIcon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[
        "mc-filter-btn",
        open ? "is-open" : "",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-expanded={open}
      onClick={onToggle}
    >
      {leadingIcon}
      <span>{label}</span>
      <ChevronDown size={12} strokeWidth={2.4} aria-hidden="true" />
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
        <span>{label}</span>
      </button>
    </li>
  );
}
