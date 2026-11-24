import { normalizeMediaUrl } from "@/lib/mediaUrl";
import { api, operatorFetch } from "./operatorApi";

export type ModelInfo = {
  id: string;
  label: string;
  avatar: string | null;
  influencerName?: string | null;
  packFaceVideoUrl?: string | null;
  packFaceVideoUrl2?: string | null;
  packFacePosterUrl?: string | null;
  packFacePosterUrl2?: string | null;
  cardPackName?: string | null;
  cardPackName2?: string | null;
};

export type ModelVideoKind = "pack-face" | "pack-face-2";

export type ModelPosterKind = "pack-face-poster" | "pack-face-2-poster";

export const MODEL_VIDEO_POSTER_KIND: Record<ModelVideoKind, ModelPosterKind> = {
  "pack-face": "pack-face-poster",
  "pack-face-2": "pack-face-2-poster",
};

const MEDIA_FIELDS = [
  "avatar",
  "packFaceVideoUrl",
  "packFaceVideoUrl2",
  "packFacePosterUrl",
  "packFacePosterUrl2",
] as const;

function presentModel(model: ModelInfo): ModelInfo {
  const next = { ...model };
  for (const field of MEDIA_FIELDS) {
    const value = next[field];
    if (typeof value === "string" && value.trim()) {
      next[field] = normalizeMediaUrl(value);
    }
  }
  return next;
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const data = await api<{ models?: ModelInfo[] }>("/api/models");
  return (data.models ?? []).map(presentModel);
}

export async function updateModel(
  modelId: string,
  payload: { cardPackName?: string; cardPackName2?: string },
): Promise<ModelInfo> {
  const model = await api<ModelInfo>(`/api/models/${encodeURIComponent(modelId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return presentModel(model);
}

async function uploadModelFile(
  modelId: string,
  kind: ModelVideoKind | ModelPosterKind,
  file: File,
): Promise<ModelInfo> {
  const form = new FormData();
  form.append("file", file);
  const response = await operatorFetch(
    `/api/models/${encodeURIComponent(modelId)}/${kind}`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return presentModel((await response.json()) as ModelInfo);
}

export function uploadModelVideo(
  modelId: string,
  kind: ModelVideoKind,
  file: File,
): Promise<ModelInfo> {
  return uploadModelFile(modelId, kind, file);
}

export function uploadModelPoster(
  modelId: string,
  kind: ModelPosterKind,
  file: File,
): Promise<ModelInfo> {
  return uploadModelFile(modelId, kind, file);
}
