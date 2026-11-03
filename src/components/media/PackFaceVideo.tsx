import { useEffect, useRef, useState } from "react";
import { releaseMediaElement } from "@/features/game/shared/media";
import {
  claimMediaDecoder,
  isIosDecoderCap,
  releaseClaimedDecoder,
} from "@/lib/memory/exclusiveMedia";

/**
 * Pack-face <video> that always drops its decoder on unmount.
 * iOS keeps a hardware decoder for any attached src (even preload=metadata
 * + autoPlay), so clips stay on a poster until tap; only one src is claimed.
 */
export function PackFaceVideo({
  src,
  poster,
  className,
  onError,
  onReady,
}: {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
  /** Fires when poster or first video frame is ready to show. */
  onReady?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const ios = isIosDecoderCap();
  const [live, setLive] = useState(() => !ios);
  const posterUrl = poster?.trim() || "";
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    setLive(!isIosDecoderCap());
  }, [src]);

  function markReady() {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady?.();
  }

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!live) {
      releaseMediaElement(video);
      return;
    }
    if (ios) {
      claimMediaDecoder(video, src);
    } else if (video.getAttribute("src") !== src) {
      video.src = src;
    }
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => {});
    return () => {
      if (ios) releaseClaimedDecoder(video);
      else releaseMediaElement(video);
    };
  }, [src, live, ios]);

  return (
    <>
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          className={className}
          draggable={false}
          onLoad={markReady}
        />
      ) : null}
      <video
        ref={ref}
        className={className}
        poster={posterUrl || undefined}
        muted
        loop
        playsInline
        autoPlay={!ios}
        preload="none"
        onError={onError}
        onLoadedData={markReady}
        onPointerDown={
          ios
            ? () => {
                setLive(true);
              }
            : undefined
        }
      />
    </>
  );
}
