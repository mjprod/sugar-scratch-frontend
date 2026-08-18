import { createContext, useContext, type ReactNode } from "react";

export type CollectionActions = {
  onPlayGame?: (modelId: string, cardId: string, cardName: string) => void;
  /** Play a published photo-scratch card from a PHOTO CARDS slot. */
  onPlayPhotoCard?: (
    modelId: string,
    photoCardId: string,
    slotIndex: number,
  ) => void;
  onViewCard?: (cardName: string) => void;
};

const CollectionActionsContext = createContext<CollectionActions>({});

export function CollectionActionsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: CollectionActions;
}) {
  return (
    <CollectionActionsContext.Provider value={value}>
      {children}
    </CollectionActionsContext.Provider>
  );
}

export function useCollectionActions() {
  return useContext(CollectionActionsContext);
}
