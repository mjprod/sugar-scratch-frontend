import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  LIBRARY_PREVIEW_CARDS,
  type LibraryPreviewCard,
} from "@/services/collection";

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
        <div className="collection-section-intro">
          <h2 id="library-heading" className="collection-section-title">
            Your Card Library
          </h2>
          <p className="collection-section-copy">
            Your revealed cards will appear here.
          </p>
        </div>
        <div className="collection-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="View Library"
            costAmount={null}
            fontSize={14}
            onClick={onViewAll}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="collection-section" aria-labelledby="library-heading">
      <div className="collection-section-head-row">
        <div className="collection-section-intro">
          <h2 id="library-heading" className="collection-section-title">
            Your Card Library
          </h2>
        </div>
        <button type="button" className="collection-text-link" onClick={onViewAll}>
          View all cards →
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
