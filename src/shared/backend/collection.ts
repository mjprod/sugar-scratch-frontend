import {
  CHARACTER_IDS,
  type CharacterId,
} from "@/shared/catalog/characters";
import { normalizeMediaUrl } from "@/services/models";

const ROLE_MATCHERS: { id: CharacterId; patterns: RegExp[] }[] = [
  { id: "policewoman", patterns: [/cop/, /police/] },
  { id: "nurse", patterns: [/nurse/] },
  { id: "teacher", patterns: [/teacher/] },
  { id: "gym", patterns: [/gym/] },
  { id: "firefighter", patterns: [/fire/, /firegirl/, /firefighter/] },
];

const THEME_ID_TO_ROLE: Record<string, CharacterId> = {
  police: "policewoman",
  cop: "policewoman",
  nurse: "nurse",
  teacher: "teacher",
  gym: "gym",
  firefighter: "firefighter",
  firegirl: "firefighter",
  fire: "firefighter",
};

export type BackendCard = {
  id: string;
  label: string;
  background: string;
  foreground: string;
  model_id: string | null;
  sort_order: number;
  photo_scratch_done: number;
  theme_id?: string | null;
  trailer?: string | null;
};

export type BackendFanCard = {
  id: string;
  label: string;
  videoUrl: string;
  characterId: CharacterId;
  modelId: string;
  sortOrder: number;
};

export type BackendFanCatalog = {
  byRole: Partial<Record<CharacterId, BackendFanCard[]>>;
  cards: BackendFanCard[];
};

export function characterIdFromBackendCard(
  card: Pick<BackendCard, "id" | "label" | "theme_id">,
): CharacterId | null {
  const themeKey = (card.theme_id ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (themeKey && THEME_ID_TO_ROLE[themeKey]) {
    return THEME_ID_TO_ROLE[themeKey]!;
  }

  const haystack = `${card.id} ${card.label} ${card.theme_id ?? ""}`.toLowerCase();
  for (const role of ROLE_MATCHERS) {
    if (role.patterns.some((pattern) => pattern.test(haystack))) {
      return role.id;
    }
  }
  return null;
}

function toBackendFanCard(card: BackendCard): BackendFanCard | null {
  if (!card.model_id) return null;
  const characterId = characterIdFromBackendCard(card);
  if (!characterId) return null;
  const trailerUrl = normalizeMediaUrl(card.trailer ?? "");
  const motionUrl =
    normalizeMediaUrl(card.foreground) || normalizeMediaUrl(card.background);
  const videoUrl = trailerUrl || motionUrl;
  if (!videoUrl) return null;
  return {
    id: card.id,
    label: card.label.trim() || card.id,
    videoUrl,
    characterId,
    modelId: card.model_id,
    sortOrder: card.sort_order ?? 0,
  };
}

export async function fetchCards(): Promise<BackendCard[] | null> {
  try {
    const response = await fetch("/api/cards", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { cards?: BackendCard[] };
    return Array.isArray(data.cards) ? data.cards : null;
  } catch {
    return null;
  }
}

export async function fetchPackFanCatalog(
  modelId?: string | null,
): Promise<BackendFanCatalog | null> {
  const cards = await fetchCards();
  if (!cards) return null;

  const published = cards
    .map(toBackendFanCard)
    .filter((card): card is BackendFanCard => Boolean(card))
    .filter((card) => !modelId || card.modelId === modelId)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );

  const byRole: Partial<Record<CharacterId, BackendFanCard[]>> = {};
  for (const card of published) {
    const list = byRole[card.characterId] ?? [];
    list.push(card);
    byRole[card.characterId] = list;
  }

  for (const id of CHARACTER_IDS) {
    if (!byRole[id]) byRole[id] = [];
  }

  return { byRole, cards: published };
}

export { normalizeMediaUrl };
