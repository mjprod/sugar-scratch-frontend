import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { AppPageShell } from "@/components/AppPageShell";
import { SubpageHeader } from "@/components/SubpageHeader";
import {
  hydrateFollowingFromModelsIfEmpty,
  listFollowing,
  markFollowingCreatorSeen,
  recentlyActiveCreators,
  sortFollowing,
  unfollowCreator,
  type FollowedCreator,
  type FollowingSort,
} from "@/services/following";
import "./following.css";

const SORT_OPTIONS: { id: FollowingSort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "recently-followed", label: "Recently Followed" },
  { id: "name", label: "Name A–Z" },
];

export function FollowingScreen({
  onBack,
  onOpenCreator,
  onDiscoverCreators,
}: {
  onBack: () => void;
  onOpenCreator: (creatorId: string) => void;
  onDiscoverCreators: () => void;
}) {
  const [items, setItems] = useState<FollowedCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<FollowingSort>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const allRef = useRef<HTMLElement | null>(null);

  function refresh() {
    setItems(listFollowing());
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void hydrateFollowingFromModelsIfEmpty()
      .then((seeded) => {
        if (cancelled) return;
        setItems(seeded.length ? seeded : listFollowing());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => sortFollowing(items, sort), [items, sort]);
  const recent = useMemo(() => recentlyActiveCreators(items), [items]);
  const count = items.length;

  function openCreator(creator: FollowedCreator) {
    markFollowingCreatorSeen(creator.id);
    refresh();
    onOpenCreator(creator.id);
  }

  function handleUnfollow(creatorId: string) {
    unfollowCreator(creatorId);
    refresh();
  }

  function scrollToAll() {
    allRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <AppPageShell
      variant="secondary"
      aria-label="Following"
      className="following-page"
    >
      <SubpageHeader
        title="Following"
        onBack={onBack}
        backLabel="Back to profile"
      />

      {loading ? (
        <FollowingSkeleton />
      ) : count === 0 ? (
        <FollowingEmpty onDiscover={onDiscoverCreators} />
      ) : (
        <div className="following-body">
          {recent.length > 0 ? (
            <section
              className="following-recent"
              aria-label="Recently active"
            >
              <div className="following-section-head">
                <h2 className="following-section-title">
                  Recently Active
                  <span className="following-active-dot" aria-hidden="true" />
                </h2>
                <button
                  type="button"
                  className="following-see-all"
                  onClick={scrollToAll}
                >
                  See All
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="following-recent-scroll">
                {recent.map((creator) => (
                  <button
                    key={creator.id}
                    type="button"
                    className="following-recent-item"
                    onClick={() => openCreator(creator)}
                  >
                    <span
                      className={[
                        "following-recent-avatar-wrap",
                        creator.hasUnseenActivity ? "is-new" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <img
                        src={creator.avatarUrl}
                        alt=""
                        className="following-recent-avatar"
                        loading="lazy"
                        draggable={false}
                      />
                    </span>
                    {creator.hasUnseenActivity ? (
                      <span className="following-new-badge">NEW</span>
                    ) : null}
                    <span className="following-recent-name">
                      {creator.displayName}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section
            ref={allRef}
            className="following-all"
            aria-label="All following"
            id="following-all"
          >
            <div className="following-section-head">
              <h2 className="following-section-title">
                All Following
                <span className="following-count-badge">{count}</span>
              </h2>
              <button
                type="button"
                className="following-sort-btn"
                aria-haspopup="dialog"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen(true)}
              >
                Sort
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="following-card-list">
              {sorted.map((creator) => (
                <FollowingCard
                  key={creator.id}
                  creator={creator}
                  onOpen={() => openCreator(creator)}
                  onOpenCollection={() => openCreator(creator)}
                  onUnfollow={() => handleUnfollow(creator.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {sortOpen ? (
        <SortSheet
          value={sort}
          onClose={() => setSortOpen(false)}
          onSelect={(next) => {
            setSort(next);
            setSortOpen(false);
          }}
        />
      ) : null}
    </AppPageShell>
  );
}

function FollowingCard({
  creator,
  onOpen,
  onOpenCollection,
  onUnfollow,
}: {
  creator: FollowedCreator;
  onOpen: () => void;
  onOpenCollection: () => void;
  onUnfollow: () => void;
}) {
  const collection = creator.currentCollection;
  const newCards =
    typeof collection?.newCardCount === "number" && collection.newCardCount > 0
      ? collection.newCardCount
      : null;

  return (
    <article className="following-card">
      <div className="following-card-top">
        <button
          type="button"
          className="following-card-identity"
          onClick={onOpen}
          aria-label={`Open ${creator.displayName}`}
        >
          <img
            src={creator.avatarUrl}
            alt=""
            className="following-card-avatar"
            loading="lazy"
            draggable={false}
          />
          <span className="following-card-meta">
            <span className="following-card-name">{creator.displayName}</span>
            {creator.username ? (
              <span className="following-card-handle">{creator.username}</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          className="following-unfollow-btn"
          onClick={onUnfollow}
        >
          Following
        </button>
      </div>

      {collection ? (
        <div className="following-collection">
          <p className="following-collection-label">Current Collection</p>
          <button
            type="button"
            className="following-collection-row"
            onClick={onOpenCollection}
            aria-label={`${collection.name} collection`}
          >
            <img
              src={collection.thumbnailUrl}
              alt=""
              className="following-collection-thumb"
              loading="lazy"
              draggable={false}
            />
            <span className="following-collection-copy">
              <span className="following-collection-name">{collection.name}</span>
              {collection.season ? (
                <span className="following-collection-season">
                  {collection.season}
                </span>
              ) : null}
              {newCards != null ? (
                <span className="following-collection-new">
                  ✨ {newCards} New Card{newCards === 1 ? "" : "s"}
                </span>
              ) : null}
            </span>
            <ChevronRight
              className="following-collection-chevron"
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function SortSheet({
  value,
  onSelect,
  onClose,
}: {
  value: FollowingSort;
  onSelect: (sort: FollowingSort) => void;
  onClose: () => void;
}) {
  return (
    <div className="following-sort-overlay" role="presentation">
      <button
        type="button"
        className="following-sort-backdrop"
        aria-label="Close sort"
        onClick={onClose}
      />
      <div
        className="following-sort-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="following-sort-title"
      >
        <p id="following-sort-title" className="following-sort-title">
          Sort creators
        </p>
        <ul className="following-sort-list">
          {SORT_OPTIONS.map((option) => {
            const selected = option.id === value;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={[
                    "following-sort-option",
                    selected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={selected}
                  onClick={() => onSelect(option.id)}
                >
                  <span
                    className={[
                      "following-sort-radio",
                      selected ? "is-on" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  />
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function FollowingEmpty({ onDiscover }: { onDiscover: () => void }) {
  return (
    <div className="following-empty">
      <div className="following-empty-icon" aria-hidden="true">
        <Users size={28} strokeWidth={1.8} />
      </div>
      <h2 className="following-empty-title">No creators followed yet</h2>
      <p className="following-empty-copy">
        Follow creators you like to find them here again.
      </p>
      <button
        type="button"
        className="following-empty-cta"
        onClick={onDiscover}
      >
        Discover Creators
      </button>
    </div>
  );
}

function FollowingSkeleton() {
  return (
    <div className="following-body" aria-hidden="true">
      <div className="following-recent">
        <div className="following-section-head">
          <span className="following-skel following-skel-title" />
          <span className="following-skel following-skel-link" />
        </div>
        <div className="following-recent-scroll">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="following-recent-item">
              <span className="following-skel following-skel-avatar" />
              <span className="following-skel following-skel-name" />
            </div>
          ))}
        </div>
      </div>
      <div className="following-all">
        <div className="following-section-head">
          <span className="following-skel following-skel-title" />
          <span className="following-skel following-skel-link" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="following-card following-card--skel">
            <div className="following-card-top">
              <span className="following-skel following-skel-avatar-lg" />
              <div className="following-card-meta">
                <span className="following-skel following-skel-line" />
                <span className="following-skel following-skel-line short" />
              </div>
            </div>
            <div className="following-collection">
              <span className="following-skel following-skel-line tiny" />
              <div className="following-collection-row">
                <span className="following-skel following-skel-thumb" />
                <div className="following-collection-copy">
                  <span className="following-skel following-skel-line" />
                  <span className="following-skel following-skel-line short" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
