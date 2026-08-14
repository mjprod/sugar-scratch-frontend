import type { CreatorProgress } from "@/services/collection";

export function ContinueCollectingSection({
  creators,
  onOpenCreator,
  onViewAll,
}: {
  creators: CreatorProgress[];
  onOpenCreator: (creatorId: string) => void;
  onViewAll: () => void;
}) {
  if (creators.length === 0) return null;

  return (
    <section className="collection-section" aria-labelledby="continue-heading">
      <div className="collection-section-head-row collection-section-head-row--inline">
        <h2 id="continue-heading" className="collection-section-title">
          Continue Collecting
        </h2>
        <button type="button" className="collection-text-link" onClick={onViewAll}>
          See All &gt;
        </button>
      </div>

      <div className="collection-creator-strip">
        {creators.map((creator) => (
          <CreatorProgressCard
            key={creator.id}
            creator={creator}
            onOpen={() => onOpenCreator(creator.id)}
          />
        ))}
      </div>
    </section>
  );
}

function CreatorProgressCard({
  creator,
  onOpen,
}: {
  creator: CreatorProgress;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="collection-creator-chip"
      onClick={onOpen}
      aria-label={`${creator.name}, ${creator.pct}% collected`}
    >
      <span className="collection-creator-ring" aria-hidden="true">
        <svg viewBox="0 0 36 36" className="size-full">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="oklch(1 0 0 / 0.14)"
            strokeWidth="2.4"
            pathLength="100"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="oklch(0.711 0.203 357.66)"
            strokeWidth="2.4"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${creator.pct} 100`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <img src={creator.avatarUrl} alt="" className="collection-creator-avatar" />
      </span>
      <span className="collection-creator-meta">
        <span className="collection-creator-name-row">
          <span className="collection-creator-name">{creator.name}</span>
          <span className="collection-creator-pct">{creator.pct}%</span>
        </span>
        <span className="collection-creator-count">
          {creator.collected} / {creator.total}
        </span>
      </span>
    </button>
  );
}
