/**
 * Search MVP — client catalog from `/api/models`.
 * No `/api/search`; Creators + Packs only.
 */

import {
  leaderboardFromModels,
  packLibraryFromModels,
  type FeaturedPack,
} from "./homepage";
import {
  loadModels,
  modelDisplayName,
  modelId,
  normalizeMediaUrl,
  type BackendModel,
} from "./models";
import { loadPackCatalog } from "./purchase";

export type SearchCreator = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
};

export type SearchPack = {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  themeName: string;
  coverImageUrl: string;
  diamondCost: number;
  cardCount: number;
};

export type SearchCatalog = {
  creators: SearchCreator[];
  packs: SearchPack[];
  trendingChips: string[];
  popularCreators: SearchCreator[];
  trendingPacks: SearchPack[];
};

export type SearchFilter = "all" | "creators" | "packs";

export type SearchResults = {
  query: string;
  creators: SearchCreator[];
  packs: SearchPack[];
  total: number;
};

function usernameFromCreator(id: string, name: string) {
  const fromId = id.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  if (fromId) return fromId;
  return name.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "creator";
}

function creatorsFromModels(models: BackendModel[]): SearchCreator[] {
  return models.map((model, index) => {
    const id = modelId(model, index);
    const name = modelDisplayName(model);
    const avatarRaw = model.avatar?.trim() ?? "";
    return {
      id,
      name,
      username: usernameFromCreator(id, name),
      avatarUrl: avatarRaw ? normalizeMediaUrl(avatarRaw) : "",
    };
  });
}

function packsFromFeatured(featured: FeaturedPack[]): SearchPack[] {
  return featured.map((pack) => ({
    id: pack.id,
    name: pack.name,
    creatorId: pack.creatorId,
    creatorName: pack.creatorName,
    themeName: pack.themeName,
    coverImageUrl: pack.coverImageUrl,
    diamondCost: pack.diamondCost,
    cardCount: pack.collectionTotal || 0,
  }));
}

function buildTrendingChips(
  creators: SearchCreator[],
  packs: SearchPack[],
): string[] {
  const chips: string[] = [];
  const seen = new Set<string>();

  function add(term: string) {
    const t = term.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    chips.push(t);
  }

  for (const creator of creators.slice(0, 4)) add(creator.name);
  for (const pack of packs) {
    if (chips.length >= 7) break;
    add(pack.themeName);
  }
  for (const pack of packs) {
    if (chips.length >= 7) break;
    add(pack.name);
  }

  return chips.slice(0, 7);
}

export function buildSearchCatalog(models: BackendModel[]): SearchCatalog {
  const creators = creatorsFromModels(models);
  const packs = packsFromFeatured(packLibraryFromModels(models));
  const ranked = leaderboardFromModels(models);
  const packById = new Map(packs.map((p) => [p.id, p]));
  const trendingPacks = ranked
    .map((row) => packById.get(row.packId))
    .filter((p): p is SearchPack => Boolean(p))
    .slice(0, 8);

  const popularFromPacks: SearchCreator[] = [];
  const seenCreator = new Set<string>();
  for (const pack of trendingPacks.length ? trendingPacks : packs) {
    if (seenCreator.has(pack.creatorId)) continue;
    const hit = creators.find((c) => c.id === pack.creatorId);
    if (!hit) continue;
    seenCreator.add(pack.creatorId);
    popularFromPacks.push(hit);
    if (popularFromPacks.length >= 8) break;
  }

  const popularCreators =
    popularFromPacks.length > 0 ? popularFromPacks : creators.slice(0, 8);

  return {
    creators,
    packs,
    trendingChips: buildTrendingChips(creators, packs),
    popularCreators,
    trendingPacks: trendingPacks.length ? trendingPacks : packs.slice(0, 8),
  };
}

function matchesQuery(haystack: string, q: string) {
  return haystack.toLowerCase().includes(q);
}

export function filterSearchCatalog(
  catalog: SearchCatalog,
  rawQuery: string,
): SearchResults {
  const query = rawQuery.trim();
  if (!query) {
    return { query: "", creators: [], packs: [], total: 0 };
  }
  const q = query.toLowerCase();

  const creators = catalog.creators.filter((c) =>
    matchesQuery(`${c.name} ${c.username} ${c.id}`, q),
  );

  const packs = catalog.packs.filter((p) =>
    matchesQuery(
      `${p.name} ${p.creatorName} ${p.themeName} ${p.id} ${p.creatorId}`,
      q,
    ),
  );

  return {
    query,
    creators,
    packs,
    total: creators.length + packs.length,
  };
}

export async function loadSearchCatalog(): Promise<SearchCatalog> {
  const [models] = await Promise.all([loadModels(), loadPackCatalog()]);
  return buildSearchCatalog(models);
}

/** Mirror browse foil routing: foil id for purchase URL, parent model when ids match. */
export function searchPackToPurchase(pack: SearchPack) {
  const foilId = pack.id !== pack.creatorId ? pack.id : undefined;
  return {
    packId: foilId ?? pack.id,
    packName: pack.name,
    themeName: pack.themeName,
    price: String(pack.diamondCost),
    creator: pack.creatorName,
    entry: "purchase" as const,
  };
}
