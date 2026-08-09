import type { CreatorPageData } from "../../flow/collection";

export function StatsBar({
  stats,
}: {
  stats: CreatorPageData["creator"]["stats"];
}) {
  const pct =
    stats.totalCollectible > 0
      ? Math.round((stats.collected / stats.totalCollectible) * 100)
      : 0;

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section
      className="cpv2-creator-summary"
      aria-label="Creator collection progress"
    >
      <p className="cpv2-summary-line">
        <span className="cpv2-summary-line-primary">
          {stats.collected} / {stats.totalCollectible} cards collected
        </span>
        <span className="cpv2-summary-sep" aria-hidden="true">
          ·
        </span>
        <span className="cpv2-summary-line-muted">{pct}% complete</span>
      </p>

      <div className="cpv2-summary-supporting">
        <MiniStat
          label="Motion"
          value={`${stats.motionCardsUnlocked} / ${stats.motionCardsTotal}`}
          onClick={() => scrollTo("cpv2-motion-cards")}
        />
        <MiniStat
          label="Photo"
          value={`${stats.photoCardsUnlocked} / ${stats.photoCardsTotal}`}
          onClick={() => scrollTo("cpv2-photo-cards")}
        />
        <MiniStat
          label="Themes"
          value={`${stats.themesCompleted} / ${stats.themeCount}`}
          onClick={() => scrollTo("cpv2-choose-theme")}
        />
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cpv2-summary-mini-stat" onClick={onClick}>
      <span className="cpv2-summary-mini-label">{label}</span>
      <span className="cpv2-summary-mini-value">{value}</span>
    </button>
  );
}
