/** Shared compact inventory tile for Ready to Reveal (cards + packs). */
export function RevealInventoryTile({
  coverUrl,
  title,
  creator,
  quantityLabel,
  ariaLabel,
  onClick,
}: {
  coverUrl: string;
  title: string;
  creator: string;
  quantityLabel: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ready-reveal-tile"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="ready-reveal-tile-art">
        <img src={coverUrl} alt="" className="size-full object-cover" />
      </span>
      <span className="ready-reveal-tile-meta">
        <span className="ready-reveal-tile-name">{title}</span>
        <span className="ready-reveal-tile-creator">{creator}</span>
        <span className="ready-reveal-tile-qty">{quantityLabel}</span>
      </span>
    </button>
  );
}
