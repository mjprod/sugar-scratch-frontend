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
import { fetchThemes, type ThemeInfo } from "@/features/game/shared/themes";
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
  resolveProductSharedMedia: (
    modelId?: string | null,
    themeId?: string | null,
  ) => SharedMedia;
  characters: Character[];
  byId: Record<CharacterId, Character>;
  byGroupId: Record<GroupId, Character>;
  modelsById: Record<string, BackendModel>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function applyThemeOverlay(
  shared: SharedMedia,
  theme?: ThemeInfo | null,
): SharedMedia {
  if (!theme) return shared;
  const start = (theme.cardOverlayColorStart ?? "").trim();
  const end = (theme.cardOverlayColorEnd ?? "").trim();
  return {
    ...shared,
    overlayBackgroundColor: start || shared.overlayBackgroundColor,
    overlayBackgroundColorEnd: end || shared.overlayBackgroundColorEnd,
  };
}

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
  const [themesById, setThemesById] = useState<Record<string, ThemeInfo>>({});
  const [productReady, setProductReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((models) => {
        if (cancelled) return;
        const nextModels: Record<string, BackendModel> = {};
        for (const model of models ?? []) {
          if (model?.id) nextModels[model.id] = model;
        }
        setModelsById(nextModels);
        setProductReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProductReady(true);
      });
    fetchThemes()
      .then((themes) => {
        if (cancelled) return;
        const nextThemes: Record<string, ThemeInfo> = {};
        for (const theme of themes ?? []) {
          if (theme?.id) nextThemes[theme.id] = theme;
        }
        setThemesById(nextThemes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveProductSharedMedia = useCallback(
    (modelId?: string | null, themeId?: string | null) => {
      const key = (modelId ?? preferredModelId ?? "").trim();
      const fromModel =
        key && modelsById[key]
          ? sharedFromModel(modelsById[key])
          : sharedFromModel(Object.values(modelsById)[0]);
      const themeKey = (themeId ?? "").trim();
      return applyThemeOverlay(
        fromModel,
        themeKey ? themesById[themeKey] : null,
      );
    },
    [modelsById, preferredModelId, themesById],
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
