import { useEffect, useRef } from "react";

/**
 * Looping muted video that drops its decoder while off-screen.
 * Safari keeps a decoded frame (and often the whole buffer) for every
 * attached <video src>, which is what was blowing the creator page.
 */
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
      if (video.getAttribute("src") !== src) video.src = src;
      video.muted = true;
      void video.play().catch(() => {});
    };
    const detach = () => {
      video.pause();
      if (!video.getAttribute("src") && !video.currentSrc) return;
      video.removeAttribute("src");
      video.load();
    };

    if (typeof IntersectionObserver === "undefined") {
      attach();
      return detach;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) attach();
        else detach();
      },
      { rootMargin: "120px 0px" },
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
