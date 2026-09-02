import { CollectionExperience } from "@/features/collection/CollectionExperience";
import { CollectionActionsProvider } from "@/features/collection/CollectionActionsContext";
import type { CharacterId } from "@/shared/catalog/characters";

/** Layers / stack mode — `_incoming` Collection coverflow browse. */
export function CreatorCollectionBrowse({
  modelId,
  focusCardId,
  onPlayGame,
  onViewCard,
}: {
  modelId: string | null;
  focusCardId?: string | null;
  onPlayGame: (modelId: string, cardId: string, cardName: string) => void;
  onViewCard: (cardName: string) => void;
}) {
  if (!modelId) {
    return (
      <p className="cpv2-reveal-hint" role="status">
        Collection browse needs a live model. Start the API on :8090, then refresh.
      </p>
    );
  }

  return (
    <div className="creator-collection-browse">
      <CollectionActionsProvider value={{ onPlayGame, onViewCard }}>
        <CollectionExperience
          ownedIds={new Set<CharacterId>()}
          modelId={modelId}
          focusCardId={focusCardId}
          embedded
        />
      </CollectionActionsProvider>
    </div>
  );
}
