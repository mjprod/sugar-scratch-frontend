import { releaseMediaElement } from "@/features/game/shared/media";
import type { CardConfig } from "./cards";

type WarmFace = {
  mediaType: CardConfig["mediaType"];
  url: string;
  posterUrl?: string;
};

export type CardMediaWarmList = {
  images: string[];
  videos: string[];
};

/**
 * Prefer stills. A detached preload="auto" video holds an iOS decoder after
 * the promise resolves — only no-poster motion faces fall back to a video,
 * and that node is released in preloadCardMedia.
 */
export function cardMediaWarmList(card: {
  mediaType: CardConfig["mediaType"];
  mediaUrl: string;
  posterUrl?: string;
  backMediaType: CardConfig["mediaType"];
  backUrl: string;
}): CardMediaWarmList {
  const images: string[] = [];
  const videos: string[] = [];

  const add = (face: WarmFace) => {
    const url = face.url.trim();
    if (!url) return;
    if (face.mediaType === "image") {
      images.push(url);
      return;
    }
    const poster = face.posterUrl?.trim();
    if (poster) {
      images.push(poster);
      return;
    }
    videos.push(url);
  };

  add({
    mediaType: card.mediaType,
    url: card.mediaUrl,
    posterUrl: card.posterUrl,
  });
  add({ mediaType: card.backMediaType, url: card.backUrl });
  return { images, videos };
}

function warmImage(url: string, timeoutMs = 1200): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    const img = new Image();
    img.onload = done;
    img.onerror = done;
    img.src = url;
    if (img.complete) done();
  });
}

function warmThenReleaseVideo(url: string, timeoutMs = 1200): Promise<void> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("canplay", done);
      video.removeEventListener("error", done);
      releaseMediaElement(video);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    video.addEventListener("loadeddata", done);
    video.addEventListener("canplay", done);
    video.addEventListener("error", done);
    video.src = url;
    try {
      video.load();
    } catch {
      done();
    }
  });
}

export function preloadCardMedia(
  card: CardConfig | null | undefined,
): Promise<void> {
  if (!card) return Promise.resolve();
  const { images, videos } = cardMediaWarmList(card);
  return Promise.all([
    ...images.map((url) => warmImage(url)),
    ...videos.map((url) => warmThenReleaseVideo(url)),
  ]).then(() => undefined);
}
