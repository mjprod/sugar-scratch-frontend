import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
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
 * filters + vertical model progress cards.
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

  const sortedCreators = useMemo(() => {
    const list = [...creators];
    if (sort === "oldest") return list.reverse();
    if (sort === "progress") {
      return list.sort((a, b) => b.pct - a.pct || b.collected - a.collected);
    }
    return list;
  }, [creators, sort]);

  const visibleCreators = useMemo(() => {
    // Local ledger can still name retired fixtures (ep1 / Neon Rain). Only
    // creators that exist on GET /api/models belong on this list.
    const known = sortedCreators.filter(
      (creator) => modelByCreator.get(creator.id) != null,
    );
    if (creatorFilter === "all") return known;
    return known.filter((creator) => creator.id === creatorFilter);
  }, [sortedCreators, creatorFilter, modelByCreator]);

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
            const collectedAll = count + motionDone;
            const totalAll = total + motionTotal;
            const pct = Math.max(
              0,
              Math.min(
                100,
                totalAll > 0 ? Math.round((collectedAll / totalAll) * 100) : 0,
              ),
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
                  <CollectionAvatarRing percent={pct} />
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

const AVATAR_RING_R = 34;
const AVATAR_RING_C = 2 * Math.PI * AVATAR_RING_R;

function CollectionAvatarRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = AVATAR_RING_C - (clamped / 100) * AVATAR_RING_C;
  return (
    <span className="mc-model-avatar-ring" aria-hidden="true">
      <svg viewBox="0 0 80 80">
        <circle
          className="mc-model-avatar-ring-track"
          cx="40"
          cy="40"
          r={AVATAR_RING_R}
          fill="none"
        />
        <circle
          className="mc-model-avatar-ring-arc"
          cx="40"
          cy="40"
          r={AVATAR_RING_R}
          fill="none"
          strokeDasharray={AVATAR_RING_C}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
      </svg>
    </span>
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
