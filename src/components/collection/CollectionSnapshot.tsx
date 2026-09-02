import type { LucideIcon } from "lucide-react";
import { Images, Layers, Users } from "lucide-react";

export type CollectionSummaryData = {
  cardsCollected: number;
  creatorsCollectedFrom: number;
  collectionsInProgress: number;
  rewardReadyCount: number;
};

export function CollectionSnapshot({
  summary,
  hasPendingReveal = false,
  onExplorePacks,
  onFocusReadyToReveal,
  onOpenMyCollection,
}: {
  summary: CollectionSummaryData;
  hasPendingReveal?: boolean;
  onExplorePacks?: () => void;
  onFocusReadyToReveal?: () => void;
  onOpenMyCollection?: () => void;
}) {
  const empty = summary.cardsCollected === 0;

  return (
    <section className="collection-snapshot" aria-label="Collection summary">
      <div className="collection-snapshot-top">
        <h2 className="collection-snapshot-heading">
          <Layers
            className="collection-snapshot-heading-icon"
            aria-hidden="true"
            strokeWidth={1.8}
          />
          Collection Summary
        </h2>
      </div>

      {empty ? (
        <div className="collection-snapshot-empty">
          <p className="collection-snapshot-empty-title">
            Your collection starts here
          </p>
          <p className="collection-snapshot-empty-copy">
            Cards you reveal will appear in your Collection.
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
              Explore Packs
            </button>
          )}
        </div>
      ) : (
        <div
          className="collection-snapshot-metrics"
          role="group"
          aria-label="Collection breakdown"
        >
          <SummaryMetric
            icon={Images}
            value={summary.cardsCollected}
            label="Cards Collected"
            accent="pink"
            onClick={onOpenMyCollection}
          />
          <span className="collection-snapshot-sep" aria-hidden="true" />
          <SummaryMetric
            icon={Users}
            value={summary.creatorsCollectedFrom}
            label="Creators"
            accent="muted"
          />
          <span className="collection-snapshot-sep" aria-hidden="true" />
          <SummaryMetric
            icon={Layers}
            value={summary.collectionsInProgress}
            label="In Progress"
            accent="muted"
            onClick={onOpenMyCollection}
          />
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  icon: Icon,
  value,
  label,
  accent,
  onClick,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  accent: "pink" | "muted";
  onClick?: () => void;
}) {
  const className = [
    "collection-snapshot-metric",
    `is-${accent}`,
    onClick ? "is-interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <Icon
        className="collection-snapshot-metric-icon"
        aria-hidden="true"
        strokeWidth={1.8}
      />
      <strong className="collection-snapshot-metric-value">{value}</strong>
      <span className="collection-snapshot-metric-label">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
