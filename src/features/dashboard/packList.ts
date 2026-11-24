export type PackListModel = {
  id: string;
  label: string;
  influencerName?: string | null;
  packFaceVideoUrl?: string | null;
  packFaceVideoUrl2?: string | null;
};

export function foilVideoCount(
  model: Pick<PackListModel, "packFaceVideoUrl" | "packFaceVideoUrl2">,
): number {
  return [model.packFaceVideoUrl, model.packFaceVideoUrl2].filter((url) => url?.trim()).length;
}

export function filterPackModels<T extends PackListModel>(models: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return models;
  return models.filter((model) => {
    const haystack = [model.id, model.label, model.influencerName ?? ""].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}
