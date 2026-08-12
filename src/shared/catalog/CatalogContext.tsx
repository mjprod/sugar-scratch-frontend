import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchModels,
  type BackendModel,
} from "@/shared/backend/collection";
import {
  CHARACTER_BY_GROUP_ID,
  CHARACTER_BY_ID,
  CHARACTER_IDS,
  DEFAULT_SHARED_MEDIA,
  indexCharactersByGroupId,
  indexCharactersById,
  type Character,
  type CharacterId,
  type GroupId,
  type SharedMedia,
} from "@/shared/catalog/characters";

type CatalogContextValue = {
  productReady: boolean;
  productSharedMedia: SharedMedia;
  resolveProductSharedMedia: (modelId?: string | null) => SharedMedia;
  characters: Character[];
  byId: Record<CharacterId, Character>;
  byGroupId: Record<GroupId, Character>;
  modelsById: Record<string, BackendModel>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function sharedFromModel(model: BackendModel | null | undefined): SharedMedia {
  if (!model) return { ...DEFAULT_SHARED_MEDIA };
  return {
    girlName:
      (model.influencerName ?? model.label ?? "").trim() ||
      DEFAULT_SHARED_MEDIA.girlName,
    influencerCity: (model.influencerCity ?? "").trim(),
    influencerCountry: (model.influencerCountry ?? "").trim(),
    flagEmoji: (model.influencerFlag ?? "").trim(),
    flagSvgUrl: (model.influencerFlagSvg ?? "").trim(),
    overlayBackgroundColor:
      (model.cardOverlayColorStart ?? "").trim() ||
      DEFAULT_SHARED_MEDIA.overlayBackgroundColor,
    overlayBackgroundColorEnd:
      (model.cardOverlayColorEnd ?? "").trim() ||
      DEFAULT_SHARED_MEDIA.overlayBackgroundColorEnd,
  };
}

export function CatalogProvider({
  children,
  preferredModelId = null,
}: {
  children: ReactNode;
  preferredModelId?: string | null;
}) {
  const [modelsById, setModelsById] = useState<Record<string, BackendModel>>(
    {},
  );
  const [productReady, setProductReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchModels()
      .then((models) => {
        if (cancelled) return;
        const next: Record<string, BackendModel> = {};
        for (const model of models ?? []) {
          if (model?.id) next[model.id] = model;
        }
        setModelsById(next);
        setProductReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProductReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveProductSharedMedia = useCallback(
    (modelId?: string | null) => {
      const key = (modelId ?? preferredModelId ?? "").trim();
      if (key && modelsById[key]) return sharedFromModel(modelsById[key]);
      const first = Object.values(modelsById)[0];
      return sharedFromModel(first);
    },
    [modelsById, preferredModelId],
  );

  const productSharedMedia = useMemo(
    () => resolveProductSharedMedia(preferredModelId),
    [preferredModelId, resolveProductSharedMedia],
  );

  const characters = useMemo(
    () => CHARACTER_IDS.map((id) => CHARACTER_BY_ID[id]),
    [],
  );
  const byId = useMemo(() => indexCharactersById(characters), [characters]);
  const byGroupId = useMemo(
    () => indexCharactersByGroupId(characters),
    [characters],
  );

  const value = useMemo<CatalogContextValue>(
    () => ({
      productReady,
      productSharedMedia,
      resolveProductSharedMedia,
      characters,
      byId: { ...CHARACTER_BY_ID, ...byId },
      byGroupId: { ...CHARACTER_BY_GROUP_ID, ...byGroupId },
      modelsById,
    }),
    [
      productReady,
      productSharedMedia,
      resolveProductSharedMedia,
      characters,
      byId,
      byGroupId,
      modelsById,
    ],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    return {
      productReady: true,
      productSharedMedia: { ...DEFAULT_SHARED_MEDIA },
      resolveProductSharedMedia: () => ({ ...DEFAULT_SHARED_MEDIA }),
      characters: CHARACTER_IDS.map((id) => CHARACTER_BY_ID[id]),
      byId: CHARACTER_BY_ID,
      byGroupId: CHARACTER_BY_GROUP_ID,
      modelsById: {},
    };
  }
  return ctx;
}
