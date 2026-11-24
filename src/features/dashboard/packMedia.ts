const POSTER_QUALITY = 0.85;

const MIME_TO_EXT: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function canvasEncodesMime(type: string): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    return probe.toDataURL(type, POSTER_QUALITY).startsWith(`data:${type}`);
  } catch {
    return false;
  }
}

let cachedPosterMime: "image/webp" | "image/jpeg" | null = null;

function preferredPosterMime(): "image/webp" | "image/jpeg" {
  if (cachedPosterMime) return cachedPosterMime;
  cachedPosterMime = canvasEncodesMime("image/webp") ? "image/webp" : "image/jpeg";
  return cachedPosterMime;
}

function videoElementFirstFrame(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const mime = preferredPosterMime();
    const dataUrl = canvas.toDataURL(mime, POSTER_QUALITY);
    if (dataUrl.startsWith(`data:${mime}`)) return dataUrl;
    return canvas.toDataURL("image/jpeg", POSTER_QUALITY);
  } catch {
    return null;
  }
}

function captureVideoElementFirstFrame(video: HTMLVideoElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const existing = videoElementFirstFrame(video);
    if (existing) {
      resolve(existing);
      return;
    }

    function cleanup() {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    }

    let settled = false;
    function settle(result?: string, error?: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("Video has no dimensions"));
    }

    function onReady() {
      const frame = videoElementFirstFrame(video);
      if (frame) settle(frame);
      else settle(undefined, new Error("Video has no dimensions"));
    }

    function onError() {
      settle(undefined, new Error("Video decode failed"));
    }

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);

    try {
      video.load();
    } catch (caught) {
      settle(undefined, caught instanceof Error ? caught : new Error("Video load failed"));
    }
  });
}

/** Poster data URL of the first decoded frame — for upload previews before the clip plays. */
export function captureVideoFirstFrame(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;

  return captureVideoElementFirstFrame(video).finally(() => {
    URL.revokeObjectURL(objectUrl);
    try {
      video.removeAttribute("src");
      video.src = "";
      video.load();
    } catch {
      // ignore
    }
  });
}

/** Poster data URL of the first decoded frame from a served clip URL. */
export function captureVideoSrcFirstFrame(src: string): Promise<string> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  return captureVideoElementFirstFrame(video).finally(() => {
    try {
      video.removeAttribute("src");
      video.src = "";
      video.load();
    } catch {
      // ignore
    }
  });
}

/**
 * Turn a canvas/data-URL image into a File for operator upload endpoints.
 * Filename extension is rewritten to match the real MIME — Safari may emit
 * PNG/JPEG bytes even when callers pass a `.webp` name.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header?.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  const ext = MIME_TO_EXT[mime] ?? ".png";
  const stem = filename.replace(/\.[^.]+$/, "") || filename;
  return new File([buffer], `${stem}${ext}`, { type: mime });
}
