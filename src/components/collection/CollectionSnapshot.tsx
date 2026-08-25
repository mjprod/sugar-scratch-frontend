import type { LucideIcon } from "lucide-react";
import { Gift, Images, Layers, Users } from "lucide-react";

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
  onClaimReward,
  onOpenMyCollection,
}: {
  summary: CollectionSummaryData;
  hasPendingReveal?: boolean;
  onExplorePacks?: () => void;
  onFocusReadyToReveal?: () => void;
  onClaimReward?: () => void;
  onOpenMyCollection?: () => void;
}) {
  const empty = summary.cardsCollected === 0;
  const rewardReady = summary.rewardReadyCount > 0;

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
        <>
          <div
            className={[
              "collection-snapshot-metrics",
              rewardReady ? "has-reward" : "",
            ]
              .filter(Boolean)
              .join(" ")}
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
            {rewardReady ? (
              <>
                <span className="collection-snapshot-sep" aria-hidden="true" />
                <SummaryMetric
                  icon={Gift}
                  value={summary.rewardReadyCount}
                  label={
                    summary.rewardReadyCount === 1
                      ? "Reward Ready"
                      : "Rewards Ready"
                  }
                  accent="reward"
                  actionLabel={
                    summary.rewardReadyCount === 1
                      ? "Claim Reward"
                      : "View Rewards"
                  }
                  onAction={onClaimReward}
                />
              </>
            ) : null}
          </div>
        </>
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
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  accent: "pink" | "muted" | "reward";
  onClick?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const className = [
    "collection-snapshot-metric",
    `is-${accent}`,
    onClick && !actionLabel ? "is-interactive" : "",
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
      {actionLabel ? (
        <button
          type="button"
          className="collection-snapshot-metric-action"
          onClick={(event) => {
            event.stopPropagation();
            onAction?.();
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </>
  );

  if (onClick && !actionLabel) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
