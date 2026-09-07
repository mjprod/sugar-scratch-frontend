import {
  DEFAULT_MODEL_ROTATION,
  DEFAULT_VIDEO_TEXTURE_TRANSFORM,
  PACK_VIDEO_FIT_MODE,
  type ModelRotation,
  type VideoFitMode,
  type VideoTextureTransform,
} from "@/shared/pack3d";

export type AssetSource = "bundled" | "upload";
export type { VideoFitMode, VideoTextureTransform, ModelRotation };

export interface ModelRotationAnchor {
  x: number;
  y: number;
  z: number;
}

export interface CameraSettings {
  distance: number;
  fov: number;
  maxDistance: number;
  minDistance: number;
}

export const DEFAULT_MODEL_ROTATION_ANCHOR: ModelRotationAnchor = {
  x: 0,
  y: 1,
  z: 0.125,
};

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  distance: 4.2,
  fov: 36,
  maxDistance: 8,
  minDistance: 2.2,
};

export interface Iteration {
  cameraSettings: CameraSettings;
  id: string;
  /** Backend model / creator id used for fan catalog + overlay. */
  characterId?: string;
  name: string;
  modelAnchor: ModelRotationAnchor;
  modelName: string;
  modelRotation: ModelRotation;
  modelSource: AssetSource;
  modelUrl: string;
  videoUrl: string;
  /** Pack-face still from the API; used before the video is attached. */
  posterUrl?: string;
  createdAt: number;
  videoSource: AssetSource;
  fitMode: VideoFitMode;
  textureTransform: VideoTextureTransform;
  price: number;
  originalPrice?: number | null;
  girlName: string;
  packNumber: number;
  packName?: string;
  flagEmoji: string;
  flagSvgUrl?: string;
  city?: string;
  country?: string;
  overlayColorStart?: string;
  overlayColorEnd?: string;
  backgroundColor: string;
}

export function formatPackCollectionLabel(girlName: string): string {
  const girl = girlName.trim() || "Collection";
  return `${girl} Collection`.replace(/ Collection Collection$/, " Collection");
}

export function formatPackNumberLabel(
  girlName: string,
  packNumber?: number | null,
): string {
  const girl = girlName.trim() || "A";
  const initial =
    girl.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/)?.[0] ?? girl.charAt(0) ?? "A";
  const number =
    packNumber != null && Number.isFinite(packNumber) ? String(packNumber) : "—";
  return `Pack Nº ${initial.toUpperCase()}${number}`;
}

export function formatPackPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export type PackItem = {
  id: string;
  characterId: string;
  name: string;
  modelUrl: string;
  modelName: string;
  videoUrl: string;
  posterUrl?: string;
  price: number;
  originalPrice?: number | null;
  girlName: string;
  packNumber: number;
  packName?: string;
  flagEmoji: string;
  flagSvgUrl?: string;
  city?: string;
  country?: string;
  overlayColorStart?: string;
  overlayColorEnd?: string;
  backgroundColor: string;
};

export function packItemToIteration(item: PackItem): Iteration {
  return {
    id: item.id,
    characterId: item.characterId,
    name: item.name,
    modelName: item.modelName,
    modelUrl: item.modelUrl,
    modelSource: "bundled",
    modelAnchor: { ...DEFAULT_MODEL_ROTATION_ANCHOR },
    modelRotation: { ...DEFAULT_MODEL_ROTATION },
    videoUrl: item.videoUrl,
    posterUrl: item.posterUrl?.trim() || undefined,
    videoSource: "bundled",
    fitMode: PACK_VIDEO_FIT_MODE,
    textureTransform: { ...DEFAULT_VIDEO_TEXTURE_TRANSFORM },
    cameraSettings: { ...DEFAULT_CAMERA_SETTINGS },
    createdAt: 0,
    price: item.price,
    originalPrice: item.originalPrice ?? null,
    girlName: item.girlName,
    packNumber: item.packNumber,
    packName: item.packName?.trim() || undefined,
    flagEmoji: item.flagEmoji,
    flagSvgUrl: item.flagSvgUrl,
    city: item.city,
    country: item.country,
    overlayColorStart: item.overlayColorStart,
    overlayColorEnd: item.overlayColorEnd,
    backgroundColor: item.backgroundColor,
  };
}
