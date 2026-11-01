import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Layers, Search, Users, X } from "lucide-react";
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

type SortId = "default" | "newest" | "oldest" | "progress";
type FilterMenu = "creator" | "sort" | null;

const FILTER_MOTION_MS = 220;
const CREATOR_SHEET_MS = 420;
const COLLECT_ROW_KEY = "collect-model-row";

function rememberCollectPlace(id: string, scrollTop: number) {
  try {
    sessionStorage.setItem(
      COLLECT_ROW_KEY,
      JSON.stringify({ id, scrollTop }),
    );
  } catch {
    /* private mode */
  }
}

function peekCollectPlace(): { id: string; scrollTop: number } | null {
  try {
    const raw = sessionStorage.getItem(COLLECT_ROW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; scrollTop?: unknown };
    if (typeof parsed?.id !== "string" || typeof parsed.scrollTop !== "number") {
      return null;
    }
    return { id: parsed.id, scrollTop: parsed.scrollTop };
  } catch {
    return null;
  }
}

function clearCollectPlace() {
  try {
    sessionStorage.removeItem(COLLECT_ROW_KEY);
  } catch {
    /* private mode */
  }
}

const SORT_OPTIONS: Array<{ id: SortId; label: string; shortLabel: string }> = [
  { id: "default", label: "Default", shortLabel: "Default" },
  { id: "newest", label: "Newest first", shortLabel: "Newest" },
  { id: "oldest", label: "Oldest first", shortLabel: "Oldest" },
  { id: "progress", label: "Most complete", shortLabel: "Complete" },
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

  const collectedCreators = useMemo(() => {
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
    const rows = [...byBoardId.values()];
    if (sort !== "default") return rows;
    const nameOf = (creator: (typeof rows)[number]) => {
      const model = modelByCreator.get(creator.id);
      return ((model && modelDisplayName(model)) || creator.name).trim();
    };
    rows.sort((a, b) =>
      nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" }),
    );
    return rows;
  }, [sortedCreators, modelByCreator, models, sort]);

  const visibleCreators = useMemo(() => {
    if (creatorFilter === "all") return collectedCreators;
    return collectedCreators.filter((creator) => creator.id === creatorFilter);
  }, [collectedCreators, creatorFilter]);

  const pickerCreators = useMemo(() => {
    const rows = collectedCreators.map((creator) => {
      const model = modelByCreator.get(creator.id) ?? null;
      return {
        id: creator.id,
        name: (model ? modelDisplayName(model) : "") || creator.name,
        avatarUrl: avatarFor(creator, model),
      };
    });
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return rows;
  }, [collectedCreators, modelByCreator]);

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

  useEffect(() => {
    if (!themesReady || !boardsReady) return;
    // Peek until the row paints — StrictMode would drop the key if we consumed first.
    let frames = 0;
    let raf = 0;
    const tryScroll = () => {
      const place = peekCollectPlace();
      if (!place) return;
      const row = document.querySelector<HTMLElement>(
        `[data-collect-creator="${CSS.escape(place.id)}"]`,
      );
      if (!row) {
        if (frames++ < 24) raf = window.requestAnimationFrame(tryScroll);
        return;
      }
      clearCollectPlace();
      const scroller = row.closest<HTMLElement>("[data-page-scroll]");
      if (scroller) {
        scroller.scrollTop = place.scrollTop;
        const rowBox = row.getBoundingClientRect();
        const scrollerBox = scroller.getBoundingClientRect();
        const above = rowBox.top < scrollerBox.top;
        const below = rowBox.bottom > scrollerBox.bottom;
        if (above || below) {
          scroller.scrollTop +=
            rowBox.top -
            scrollerBox.top -
            scroller.clientHeight / 2 +
            rowBox.height / 2;
        }
      } else {
        row.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    };
    raf = window.requestAnimationFrame(tryScroll);
    return () => window.cancelAnimationFrame(raf);
  }, [themesReady, boardsReady, visibleCreators]);

  const listFadeClass = [
    fadeTop ? "has-fade-top" : "",
    fadeBottom ? "has-fade-bottom" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const creatorFilterLabel =
    creatorFilter === "all"
      ? "All Creators"
      : (pickerCreators.find((c) => c.id === creatorFilter)?.name ??
        "All Creators");
  const sortShortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.shortLabel ?? "Sort";

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
            label={sortShortLabel}
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
        <FilterSheet
          open={openMenu === "sort"}
          title="Sort"
          anchor="left"
          onClose={() => setOpenMenu(null)}
        >
          {SORT_OPTIONS.map((option) => (
            <FilterOption
              key={option.id}
              label={option.label}
              selected={sort === option.id}
              onSelect={() => {
                setSort(option.id);
                setOpenMenu(null);
              }}
            />
          ))}
        </FilterSheet>
        <CreatorPickerOverlay
          open={openMenu === "creator"}
          selectedId={creatorFilter}
          creators={pickerCreators}
          onSelect={(id) => {
            setCreatorFilter(id);
            setOpenMenu(null);
          }}
          onClose={() => setOpenMenu(null)}
        />
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
          className={[
            "mc-model-list",
            peekCollectPlace() ? "" : "is-reveal",
            listFadeClass,
          ]
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
                creatorId={creator.id}
                index={index}
                name={name}
                place={place}
                avatarUrl={avatarFor(creator, model)}
                progress={progress}
                onClick={() => {
                  const scroller =
                    document.querySelector<HTMLElement>("[data-page-scroll]");
                  rememberCollectPlace(creator.id, scroller?.scrollTop ?? 0);
                  onOpenCreator(creator.id);
                }}
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

function CreatorPickerOverlay({
  open,
  selectedId,
  creators,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: string;
  creators: Array<{ id: string; name: string; avatarUrl: string }>;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const frozen = useRef(creators);
  const onCloseRef = useRef(onClose);
  if (open) frozen.current = creators;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setVisible(true);
      setLeaving(false);
      return;
    }
    if (!visible) return;
    setLeaving(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(
      () => {
        setVisible(false);
        setLeaving(false);
      },
      reduce ? 0 : CREATOR_SHEET_MS,
    );
    return () => window.clearTimeout(id);
  }, [open, visible]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const locked: Array<{ el: HTMLElement; overflow: string }> = [];
    document.querySelectorAll<HTMLElement>("[data-page-scroll]").forEach((el) => {
      locked.push({ el, overflow: el.style.overflow });
      el.style.overflow = "hidden";
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      for (const item of locked) item.el.style.overflow = item.overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={[
        "pack-library-root",
        "mc-creator-overlay",
        "fixed inset-0 z-[5150] flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden",
        leaving ? "is-leaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="presentation"
    >
      <button
        type="button"
        className="pack-library-overlay mc-creator-overlay-scrim absolute inset-0"
        aria-label="Close creators"
        onClick={onClose}
      />
      <div
        className="pack-library-panel mc-creator-overlay-sheet relative z-[1] mx-auto mt-auto flex min-h-0 w-full max-w-[75rem] flex-1 flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Creators"
      >
        <div className="mc-creator-overlay-inner">
          <div className="mc-creator-overlay-head">
            <p className="hub-section-label mc-creator-overlay-title">
              Creators
            </p>
            <button
              type="button"
              className="mc-creator-overlay-close"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mc-creator-overlay-scroll">
            <ul className="mc-creator-overlay-list">
              <FilterOption
                label="All Creators"
                selected={selectedId === "all"}
                onSelect={() => onSelect("all")}
                icon={<Users size={18} strokeWidth={2.2} aria-hidden="true" />}
              />
              {frozen.current.map((creator) => (
                <FilterOption
                  key={creator.id}
                  label={creator.name}
                  selected={selectedId === creator.id}
                  onSelect={() => onSelect(creator.id)}
                  avatarUrl={creator.avatarUrl}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterSheet({
  open,
  title,
  anchor,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  anchor: "left" | "right";
  onClose: () => void;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const frozen = useRef({ title, children });
  if (open) frozen.current = { title, children };

  useEffect(() => {
    if (open) {
      setVisible(true);
      setLeaving(false);
      return;
    }
    if (!visible) return;
    setLeaving(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(
      () => {
        setVisible(false);
        setLeaving(false);
      },
      reduce ? 0 : FILTER_MOTION_MS,
    );
    return () => window.clearTimeout(id);
  }, [open, visible]);

  if (!visible) return null;
  return (
    <div
      className={[
        "my-collection-filter-overlay",
        anchor === "right" ? "is-anchor-right" : "is-anchor-left",
        leaving ? "is-leaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
        aria-label={frozen.current.title}
      >
        <p className="my-collection-filter-title">{frozen.current.title}</p>
        <ul className="my-collection-filter-list">{frozen.current.children}</ul>
      </div>
    </div>
  );
}

function FilterOption({
  label,
  selected,
  onSelect,
  avatarUrl,
  icon,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  avatarUrl?: string;
  icon?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        className={[
          "my-collection-filter-option",
          avatarUrl || icon ? "has-face" : "",
          selected ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="mc-creator-overlay-avatar"
            loading="lazy"
            decoding="async"
          />
        ) : icon ? (
          <span className="mc-creator-overlay-avatar is-all" aria-hidden="true">
            {icon}
          </span>
        ) : (
          <span
            className={[
              "my-collection-filter-radio",
              selected ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
        )}
        <span>{label}</span>
      </button>
    </li>
  );
}
