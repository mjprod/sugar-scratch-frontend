/** Creator models and foil packs from `/api/models`. */

export type BackendModel = {
  id?: string | null;
  label?: string | null;
  created_at?: number | null;
  influencerName?: string | null;
  influencerCity?: string | null;
  influencerCountry?: string | null;
  influencerFlag?: string | null;
  influencerFlagSvg?: string | null;
  cardOverlayColorStart?: string | null;
  cardOverlayColorEnd?: string | null;
  cardPackName?: string | null;
  cardPackName2?: string | null;
  packFaceVideoUrl?: string | null;
  packFaceVideoUrl2?: string | null;
  swipeVideoUrl?: string | null;
};

export type FoilSlot = 1 | 2;

export type FoilPack = {
  slot: FoilSlot;
  id: string;
  label: string;
  videoUrl: string;
};

export type ModelProfile = {
  id: string;
  name: string;
  collectionLabel: string;
  city: string | null;
  country: string | null;
  flagEmoji: string | null;
  flagSvgUrl: string | null;
  overlayColorStart: string | null;
  overlayColorEnd: string | null;
  swipeVideoUrl: string | null;
  packs: FoilPack[];
};

const PROXIED_MEDIA_PREFIXES = [
  "/api/",
  "/cards/",
  "/models/",
  "/photo-scratch/",
  "/mesh/",
] as const;

export function formatCollectionLabel(name: string) {
  const trimmed = name.trim();
  return trimmed ? `${trimmed} Collection` : "Collection";
}

export function isVideoSrc(src: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(src) || /\/models\//i.test(src);
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isProxiedMediaPath(pathname: string) {
  return PROXIED_MEDIA_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  );
}

/** Rewrite API media onto the Vite proxy so videos load same-origin. */
export function normalizeMediaUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;

  if (/^(?:https?:)?\/\//i.test(raw)) {
    try {
      const absolute = new URL(raw, "https://placeholder.local");
      const pathWithSearch = `${absolute.pathname}${absolute.search}${absolute.hash}`;
      if (isProxiedMediaPath(absolute.pathname)) return pathWithSearch;
      if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) return raw;
      return pathWithSearch;
    } catch {
      return raw;
    }
  }

  const withoutPublic = raw.replace(/^\.?\/?public\//, "");
  return withoutPublic.startsWith("/") ? withoutPublic : `/${withoutPublic}`;
}

function optionalMedia(value: unknown): string | null {
  const raw = optionalString(value);
  if (!raw) return null;
  return normalizeMediaUrl(raw) || null;
}

export function modelDisplayName(model: BackendModel) {
  return (
    optionalString(model.influencerName) ??
    optionalString(model.label) ??
    optionalString(model.id) ??
    "Model"
  );
}

export function modelId(model: BackendModel, fallbackIndex = 0) {
  return optionalString(model.id) ?? `model-${fallbackIndex + 1}`;
}

export function matchModel(
  models: BackendModel[],
  hints: { packId?: string | null; name?: string | null } = {},
): BackendModel | null {
  if (!models.length) return null;

  const packId = optionalString(hints.packId);
  if (packId) {
    const exact = models.find((model) => model.id === packId);
    if (exact) return exact;
    const key = normalizeKey(packId);
    const fuzzy = models.find((model) => {
      const id = normalizeKey(model.id ?? "");
      const label = normalizeKey(model.label ?? "");
      const name = normalizeKey(model.influencerName ?? "");
      return id === key || label === key || name === key;
    });
    if (fuzzy) return fuzzy;
  }

  const nameKey = normalizeKey(hints.name ?? "");
  if (nameKey) {
    const byName = models.find((model) => {
      const influencer = normalizeKey(model.influencerName ?? "");
      const label = normalizeKey(model.label ?? "");
      return influencer === nameKey || label === nameKey;
    });
    if (byName) return byName;
  }

  return models.length === 1 ? models[0]! : null;
}

export function foilsFromModel(model: BackendModel): FoilPack[] {
  const id = modelId(model);
  const face1 = optionalMedia(model.packFaceVideoUrl);
  const face2 = optionalMedia(model.packFaceVideoUrl2) ?? face1;
  const packs: FoilPack[] = [];
  if (face1) {
    packs.push({
      slot: 1,
      id: `${id}-1`,
      label: optionalString(model.cardPackName) ?? "Pack 1",
      videoUrl: face1,
    });
  }
  if (face2) {
    packs.push({
      slot: 2,
      id: `${id}-2`,
      label: optionalString(model.cardPackName2) ?? "Pack 2",
      videoUrl: face2,
    });
  }
  return packs;
}

export function profileFromModel(model: BackendModel): ModelProfile {
  const name = modelDisplayName(model);
  return {
    id: modelId(model),
    name,
    collectionLabel: formatCollectionLabel(name),
    city: optionalString(model.influencerCity),
    country: optionalString(model.influencerCountry),
    flagEmoji: optionalString(model.influencerFlag),
    flagSvgUrl: optionalMedia(model.influencerFlagSvg),
    overlayColorStart: optionalString(model.cardOverlayColorStart),
    overlayColorEnd: optionalString(model.cardOverlayColorEnd),
    swipeVideoUrl: optionalMedia(model.swipeVideoUrl),
    packs: foilsFromModel(model),
  };
}

function sortModels(models: BackendModel[]) {
  return [...models].sort((a, b) => {
    const aCreated =
      typeof a.created_at === "number" && Number.isFinite(a.created_at)
        ? a.created_at
        : Number.POSITIVE_INFINITY;
    const bCreated =
      typeof b.created_at === "number" && Number.isFinite(b.created_at)
        ? b.created_at
        : Number.POSITIVE_INFINITY;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return modelDisplayName(a).localeCompare(modelDisplayName(b));
  });
}

let modelsPromise: Promise<BackendModel[]> | null = null;

export async function fetchModels(): Promise<BackendModel[]> {
  try {
    const response = await fetch("/api/models", { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { models?: BackendModel[] };
    return Array.isArray(data.models) ? sortModels(data.models) : [];
  } catch {
    return [];
  }
}

export function loadModels() {
  modelsPromise ??= fetchModels();
  return modelsPromise;
}

export async function loadModelProfile(
  packId: string,
  name?: string | null,
): Promise<ModelProfile | null> {
  const models = await loadModels();
  const model = matchModel(models, { packId, name });
  return model ? profileFromModel(model) : null;
}
