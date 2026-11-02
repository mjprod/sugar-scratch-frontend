import { useEffect, useRef } from "react";
import {
  claimMediaDecoder,
  releaseClaimedDecoder,
} from "@/lib/memory/exclusiveMedia";

/**
 * Looping muted video that drops its decoder while off-screen.
 * Safari keeps a decoded frame (and often the whole buffer) for every
 * attached <video src>, which is what was blowing the creator page.
 */
/** iOS keeps a decoded buffer until src is removed and load() runs. */
export function releaseVideos(root: ParentNode = document) {
  root.querySelectorAll("video").forEach((video) => {
    if (!video.getAttribute("src") && !video.currentSrc) return;
    releaseClaimedDecoder(video);
  });
}

export function OffscreenVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;

    const attach = () => {
      claimMediaDecoder(video, src);
      video.muted = true;
      void video.play().catch(() => {});
    };
    const detach = () => {
      releaseClaimedDecoder(video);
    };

    if (typeof IntersectionObserver === "undefined") {
      attach();
      return detach;
    }

    // Viewport root misses iOS nested overflow; the page scroller is the clip.
    // No rootMargin: Ultra sits on top of packs, and 120px kept both decoders live.
    const page = video.closest("[data-page-scroll]");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) attach();
        else detach();
      },
      {
        root: page instanceof Element ? page : null,
      },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      detach();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
    />
  );
}
