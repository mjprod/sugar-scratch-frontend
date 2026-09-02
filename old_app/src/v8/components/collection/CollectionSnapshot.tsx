import type { LucideIcon } from "lucide-react";
import { ChevronRight, Image, Play, Users } from "lucide-react";
import { type CollectionLibraryFilter } from "../../flow/collection";

export function CollectionSnapshot({
  summary,
  onOpenLibrary,
  onOpenCreators,
}: {
  summary: {
    uniqueCards: number;
    motionCards: number;
    photoCards: number;
    creators: number;
  };
  onOpenLibrary: (filter: CollectionLibraryFilter) => void;
  onOpenCreators: () => void;
}) {
  return (
    <section className="collection-snapshot" aria-label="Collection summary">
      <div className="collection-snapshot-top">
        <p className="collection-snapshot-total">
          <strong className="collection-snapshot-value">{summary.uniqueCards}</strong>
          <span className="collection-snapshot-primary-label">Collected</span>
        </p>
        <button
          type="button"
          className="collection-snapshot-link"
          onClick={() => onOpenLibrary("all")}
        >
          View All
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="collection-snapshot-stats" role="group" aria-label="Collection breakdown">
        <SnapshotStat
          icon={Play}
          value={summary.motionCards}
          label="Motion Cards"
          onClick={() => onOpenLibrary("motion")}
        />
        <div className="collection-snapshot-divider" aria-hidden="true" />
        <SnapshotStat
          icon={Image}
          value={summary.photoCards}
          label="Photo Cards"
          onClick={() => onOpenLibrary("photo")}
        />
        <div className="collection-snapshot-divider" aria-hidden="true" />
        <SnapshotStat
          icon={Users}
          value={summary.creators}
          label="Creators"
          onClick={onOpenCreators}
        />
      </div>
    </section>
  );
}

function SnapshotStat({
  icon: Icon,
  value,
  label,
  onClick,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="collection-snapshot-stat" onClick={onClick}>
      <Icon className="collection-snapshot-icon" aria-hidden="true" strokeWidth={1.8} />
      <strong className="collection-snapshot-stat-value">{value}</strong>
      <span className="collection-snapshot-stat-label">{label}</span>
    </button>
  );
}
