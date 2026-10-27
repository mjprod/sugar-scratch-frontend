import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, Layers, Search } from "lucide-react";
import {
  InfluencerHolder,
  InfluencerHolderSkeleton,
} from "@/components/collection/InfluencerHolder";
import { useCreatorsCollectedThemes } from "@/components/collection/MyCollectionLivePanel";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { useSearch } from "@/contexts/SearchContext";
import { useModels } from "@/hooks/useModels";
import type { CreatorProgress } from "@/services/collection";
import {
  collectionProgressFromBoard,
  loadCreatorBoard,
  type CreatorBoard,
} from "@/services/creatorBoard";
import {
  canonicalCreatorId,
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
  const { ready: themesReady } = useCreatorsCollectedThemes(creatorIds);

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

  const boardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const creator of creators) {
      const model = modelByCreator.get(creator.id);
      if (!model) continue;
      ids.add(
        canonicalCreatorId(models, {
          creatorId: creator.id,
          name: creator.name,
        }),
      );
    }
    return [...ids];
  }, [creators, modelByCreator, models]);
  const { boards, ready: boardsReady } = useCreatorBoards(boardIds);
  const listRef = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const updateFades = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setFadeTop(el.scrollTop > 4);
    setFadeBottom(max - el.scrollTop > 4);
  }, []);

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
    // creators that exist on GET /api/models belong on this list, and a
    // display-name slug must collapse onto the board creator id.
    const byBoardId = new Map<string, (typeof sortedCreators)[number]>();
    for (const creator of sortedCreators) {
      const model = modelByCreator.get(creator.id);
      if (!model) continue;
      const id = canonicalCreatorId(models, {
        creatorId: creator.id,
        name: creator.name,
      });
      const row = { ...creator, id };
      const existing = byBoardId.get(id);
      if (
        !existing ||
        row.collected > existing.collected ||
        (row.collected === existing.collected && row.themesStarted > existing.themesStarted)
      ) {
        byBoardId.set(id, row);
      }
    }
    const known = [...byBoardId.values()];
    if (creatorFilter === "all") return known;
    return known.filter((creator) => creator.id === creatorFilter);
  }, [sortedCreators, creatorFilter, modelByCreator, models]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [updateFades, themesReady, boardsReady, visibleCreators.length]);

  const listFadeClass = [
    fadeTop ? "has-fade-top" : "",
    fadeBottom ? "has-fade-bottom" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const creatorFilterLabel =
    creatorFilter === "all"
      ? "All Creators"
      : (creators.find((c) => c.id === creatorFilter)?.name ?? "All Creators");
  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "Sort";

  if (creators.length === 0) {
    return (
      <section
        id="my-collection"
        className="mc-models"
        aria-labelledby="my-collection-heading"
      >
        <h2 id="my-collection-heading" className="mc-models-title">
          Keep Collecting
        </h2>
        <div className="mc-models-empty">
          <h3 className="collection-empty-title">Your collection starts here</h3>
          <p className="collection-empty-copy">
            Cards you reveal will appear here.
          </p>
          <div className="collection-cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              label={hasPendingReveal ? "Go to Ready to Reveal" : "Explore"}
              costAmount={null}
              onClick={hasPendingReveal ? onFocusReadyToReveal : onExplorePacks}
            />
          </div>
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
        Keep Collecting
      </h2>

      <div className="mc-models-filters" role="group" aria-label="Filters">
        <div className="mc-models-filter-left">
          <FilterButton
            label={creatorFilterLabel}
            open={openMenu === "creator"}
            active={creatorFilter !== "all"}
            onToggle={() =>
              setOpenMenu((m) => (m === "creator" ? null : "creator"))
            }
          />
          <FilterButton
            label={openMenu === "sort" || sort !== "newest" ? sortLabel : "Sort"}
            open={openMenu === "sort"}
            active={sort !== "newest"}
            leadingIcon={
              <Layers size={14} strokeWidth={2.2} aria-hidden="true" />
            }
            onToggle={() => setOpenMenu((m) => (m === "sort" ? null : "sort"))}
          />
        </div>
        <button
          type="button"
          className="mc-models-search"
          aria-label="Search creators"
          onClick={openSearch}
        >
          <Search size={16} strokeWidth={2.2} aria-hidden />
        </button>
        {openMenu ? (
          <FilterSheet
            title={openMenu === "creator" ? "Creators" : "Sort"}
            anchor="left"
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
              {visibleCreators.map((creator) => (
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
      </div>

      {!themesReady || !boardsReady ? (
        <div
          ref={listRef}
          className={["mc-model-list is-skeleton", listFadeClass]
            .filter(Boolean)
            .join(" ")}
          aria-busy="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <InfluencerHolderSkeleton key={index} />
          ))}
        </div>
      ) : visibleCreators.length === 0 ? (
        <div className="mc-models-empty">
          <h3 className="collection-empty-title">No collections found</h3>
          <p className="collection-empty-copy">Try another Creator.</p>
          <div className="collection-cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              label="Clear Filters"
              costAmount={null}
              onClick={() => setCreatorFilter("all")}
            />
          </div>
        </div>
      ) : (
        <div
          key={`${creatorFilter}:${sort}`}
          ref={listRef}
          className={["mc-model-list is-reveal", listFadeClass]
            .filter(Boolean)
            .join(" ")}
          role="list"
          aria-label="Models"
        >
          {visibleCreators.map((creator, index) => {
            const model = modelByCreator.get(creator.id) ?? null;
            const progress = collectionProgressFromBoard(boards[creator.id]);
            const name =
              (model ? modelDisplayName(model) : "") || creator.name;
            const place = locationLabel(model);

            return (
              <InfluencerHolder
                key={creator.id}
                index={index}
                name={name}
                place={place}
                avatarUrl={avatarFor(creator, model)}
                progress={progress}
                onClick={() => onOpenCreator(creator.id)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function useCreatorBoards(creatorIds: string[]): {
  boards: Record<string, CreatorBoard | null>;
  ready: boolean;
} {
  const [boards, setBoards] = useState<Record<string, CreatorBoard | null>>({});
  const [ready, setReady] = useState(false);
  const idsKey = creatorIds.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split("|") : [];
    if (ids.length === 0) {
      setBoards({});
      setReady(true);
      return;
    }

    setReady(false);
    void Promise.all(
      ids.map(async (creatorId) => {
        const board = await loadCreatorBoard(creatorId);
        return [creatorId, board] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, CreatorBoard | null> = {};
      for (const [creatorId, board] of entries) next[creatorId] = board;
      setBoards(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return { boards, ready };
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
  anchor,
  onClose,
  children,
}: {
  title: string;
  anchor: "left" | "right";
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "my-collection-filter-overlay",
        anchor === "right" ? "is-anchor-right" : "is-anchor-left",
      ].join(" ")}
      role="presentation"
    >
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
