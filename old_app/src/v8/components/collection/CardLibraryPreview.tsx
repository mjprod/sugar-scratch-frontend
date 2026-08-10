import {
  LIBRARY_PREVIEW_CARDS,
  type LibraryPreviewCard,
} from "../../flow/collection";

export function CardLibraryPreview({
  onViewAll,
  onOpenCard,
}: {
  onViewAll: () => void;
  onOpenCard: (card: LibraryPreviewCard) => void;
}) {
  const cards = LIBRARY_PREVIEW_CARDS;

  if (cards.length === 0) {
    return (
      <section className="collection-section" aria-labelledby="library-heading">
        <div className="collection-section-head-row collection-section-head-row--inline">
          <h2 id="library-heading" className="collection-section-title">
            Your Card Library
          </h2>
          <button type="button" className="collection-text-link" onClick={onViewAll}>
            View All &gt;
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="collection-section" aria-labelledby="library-heading">
      <div className="collection-section-head-row collection-section-head-row--inline">
        <h2 id="library-heading" className="collection-section-title">
          Your Card Library
        </h2>
        <button type="button" className="collection-text-link" onClick={onViewAll}>
          View All &gt;
        </button>
      </div>

      <div className="collection-h-row">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="library-preview-card"
            onClick={() => onOpenCard(card)}
            aria-label={`${card.name}, ${card.rarity}`}
          >
            <img src={card.coverUrl} alt="" className="size-full object-cover" />
            <div className="library-preview-shade" />
            {card.isNew ? <span className="library-preview-new">NEW</span> : null}
            <span className="library-preview-rarity">{card.rarity}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
