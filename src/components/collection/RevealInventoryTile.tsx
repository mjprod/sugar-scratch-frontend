/** Shared inventory tile for Ready to Reveal (packs + cards). */
import { useEffect, useRef, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { PACK_PHOTOS } from "@/lib/photos";
import { isVideoSrc } from "@/services/models";

export function RevealInventoryTile({
  coverUrl,
  posterUrl,
  title,
  creator,
  quantityLabel,
  typeLabel,
  actionLabel,
  ariaLabel,
  onClick,
  autoplayVideo = false,
  mediaId,
}: {
  coverUrl: string;
  /** API pack-face still; preferred while video is off-screen / not live. */
  posterUrl?: string;
  title: string;
  creator: string;
  quantityLabel?: string;
  typeLabel?: string;
  actionLabel: string;
  ariaLabel: string;
  onClick: () => void;
  /** Mount + autoplay decoder; false keeps poster / static frame only. */
  autoplayVideo?: boolean;
  /** IntersectionObserver id for live-video budget. */
  mediaId?: string;
}) {
  const cover = (coverUrl || "").trim();
  const poster = (posterUrl || "").trim();
  const coverIsVideo = cover ? isVideoSrc(cover) : false;
  const playVideo = coverIsVideo && autoplayVideo;
  const imageFallback = poster || (!coverIsVideo ? cover : "") || PACK_PHOTOS.ep1;
  const [imgSrc, setImgSrc] = useState(imageFallback);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setImgSrc(imageFallback);
  }, [imageFallback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playVideo) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    void video.play().catch(() => {});
    return () => {
      video.pause();
    };
  }, [playVideo, cover]);

  function fallbackImg() {
    if (imgSrc !== PACK_PHOTOS.ep1) setImgSrc(PACK_PHOTOS.ep1);
  }

  return (
    <article
      className="ready-reveal-tile"
      data-ready-reveal-id={mediaId || undefined}
    >
      <button
        type="button"
        className="ready-reveal-tile-art-btn"
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {/* Poster / still always paints first so off-screen tiles stay cheap. */}
        <img
          src={imgSrc}
          alt=""
          className="ready-reveal-tile-art-img"
          loading="lazy"
          decoding="async"
          onError={fallbackImg}
        />
        {playVideo ? (
          <video
            ref={videoRef}
            key={cover}
            src={cover}
            poster={poster || undefined}
            className="ready-reveal-tile-art-img ready-reveal-tile-art-video"
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
            onError={fallbackImg}
          />
        ) : null}
        {!playVideo && coverIsVideo && !poster ? (
          // No API poster and not in the live budget — static first frame only.
          <video
            src={cover}
            className="ready-reveal-tile-art-img ready-reveal-tile-art-video"
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            onLoadedData={(event) => {
              const video = event.currentTarget;
              try {
                video.pause();
                if (video.currentTime < 0.05) video.currentTime = 0.001;
              } catch {
                /* ignore seek failures */
              }
            }}
            onError={fallbackImg}
          />
        ) : null}
      </button>
      <div className="ready-reveal-tile-body">
        <button
          type="button"
          className="ready-reveal-tile-meta"
          onClick={onClick}
          tabIndex={-1}
        >
          <span className="ready-reveal-tile-creator">{creator}</span>
          <span className="ready-reveal-tile-name">{title}</span>
          {quantityLabel ? (
            <span className="ready-reveal-tile-qty">{quantityLabel}</span>
          ) : null}
          {typeLabel ? (
            <span className="ready-reveal-tile-type">{typeLabel}</span>
          ) : null}
        </button>
        <div className="ready-reveal-tile-action">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label={actionLabel}
            costAmount={null}
            fontSize={12}
            onClick={onClick}
          />
        </div>
      </div>
    </article>
  );
}

