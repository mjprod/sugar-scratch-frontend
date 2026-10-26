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
}: {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const ios = isIosDecoderCap();
  const [live, setLive] = useState(() => !ios);
  const posterUrl = poster?.trim() || "";

  useEffect(() => {
    setLive(!isIosDecoderCap());
  }, [src]);

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
        <img src={posterUrl} alt="" className={className} draggable={false} />
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
