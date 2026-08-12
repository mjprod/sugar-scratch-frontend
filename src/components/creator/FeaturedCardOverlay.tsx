import { X } from "lucide-react";
import { CollectionExperience } from "@/features/collection/CollectionExperience";
import { CollectionActionsProvider } from "@/features/collection/CollectionActionsContext";
import type { CharacterId } from "@/shared/catalog/characters";

/**
 * Featured Collection chrome (HoloCard + Play/View/Gift + PHOTO CARDS)
 * opened from the creator grid motion-card row.
 */
export function FeaturedCardOverlay({
  modelId,
  cardId,
  onClose,
  onPlayGame,
  onViewCard,
}: {
  modelId: string;
  cardId: string;
  onClose: () => void;
  onPlayGame: (modelId: string, cardId: string, cardName: string) => void;
  onViewCard: (cardName: string) => void;
}) {
  return (
    <div className="creator-featured-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="creator-featured-close"
        aria-label="Close featured card"
        onClick={onClose}
      >
        <X className="size-5" />
      </button>
      <CollectionActionsProvider
        value={{
          onPlayGame,
          onViewCard,
        }}
      >
        <div className="creator-featured-stage">
          <CollectionExperience
            ownedIds={new Set<CharacterId>()}
            modelId={modelId}
            focusCardId={cardId}
            embedded
          />
        </div>
      </CollectionActionsProvider>
    </div>
  );
}
