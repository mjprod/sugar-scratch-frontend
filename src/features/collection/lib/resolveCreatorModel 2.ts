import { fetchModels, type BackendModel } from "@/shared/backend/collection";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Map a creator route id (e.g. `sophia`) onto a backend `/api/models` id.
 * When no name match exists, fall back to the first published model so the
 * creator page can still show live Collection data in local/dev.
 */
export async function resolveModelIdForCreator(
  creatorId: string,
): Promise<{ modelId: string | null; model: BackendModel | null }> {
  const needle = normalizeKey(creatorId);
  const models = await fetchModels();
  if (!models?.length) return { modelId: null, model: null };

  if (!needle) {
    const first = models[0]!;
    return { modelId: first.id, model: first };
  }

  const scored = models
    .map((model) => {
      const id = normalizeKey(model.id);
      const label = normalizeKey(model.label ?? "");
      const influencer = normalizeKey(model.influencerName ?? "");
      let score = 0;
      if (id === needle) score = 100;
      else if (influencer === needle) score = 90;
      else if (label === needle) score = 80;
      else if (id.includes(needle) || needle.includes(id)) score = 60;
      else if (influencer.includes(needle) || needle.includes(influencer))
        score = 50;
      else if (label.includes(needle) || needle.includes(label)) score = 40;
      return { model, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.model ?? models[0]!;
  return { modelId: best.id, model: best };
}
