import { CREATOR_PROGRESS, type CreatorProgress } from "@/services/collection";

export function ContinueCollectingSection({
  onOpenCreator,
  onViewAll,
}: {
  onOpenCreator: (creatorId: string) => void;
  onViewAll: () => void;
}) {
  const creators = CREATOR_PROGRESS;
  if (creators.length === 0) return null;

  return (
    <section className="collection-section" aria-labelledby="continue-heading">
      <div className="collection-section-head-row">
        <div className="collection-section-intro">
          <h2 id="continue-heading" className="collection-section-title">
            Continue Collecting
          </h2>
          <p className="collection-section-copy">
            Track your progress across all your favorite creators.
          </p>
        </div>
        <button type="button" className="collection-text-link" onClick={onViewAll}>
          View all creators →
        </button>
      </div>

      <div className="collection-h-row">
        {creators.map((creator, index) => (
          <CreatorProgressCard
            key={creator.id}
            creator={creator}
            featured={index === 0}
            onOpen={() => onOpenCreator(creator.id)}
          />
        ))}
      </div>
    </section>
  );
}

function CreatorProgressCard({
  creator,
  featured,
  onOpen,
}: {
  creator: CreatorProgress;
  featured?: boolean;
  onOpen: () => void;
}) {
  const ctaLabel =
    creator.cta === "claim"
      ? "Claim Reward"
      : creator.cta === "view"
        ? "View Collection"
        : "Continue";

  return (
    <article
      className={["creator-progress-card", featured ? "is-featured" : ""].join(" ")}
    >
      <button type="button" className="creator-progress-hit" onClick={onOpen}>
        <div className="creator-progress-media">
          <img src={creator.coverUrl} alt="" className="size-full object-cover" />
          <div className="creator-progress-shade" />
          <div className="creator-progress-ring" aria-hidden="true">
            <svg viewBox="0 0 36 36" className="size-full">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2.4"
                pathLength="100"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#ff5fa2"
                strokeWidth="2.4"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${creator.pct} 100`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span>{creator.pct}%</span>
          </div>
        </div>
        <div className="creator-progress-body">
          <h3 className="creator-progress-name">{creator.name}</h3>
          <p className="creator-progress-count">
            {creator.collected} / {creator.total}
          </p>
          <div className="creator-progress-bar" aria-hidden="true">
            <div style={{ width: `${creator.pct}%` }} />
          </div>
          <p className="creator-progress-themes">
            {creator.themesStarted} of {creator.themesTotal} Themes Started
          </p>
        </div>
      </button>
      <button type="button" className="creator-progress-cta" onClick={onOpen}>
        {ctaLabel} →
      </button>
    </article>
  );
}
