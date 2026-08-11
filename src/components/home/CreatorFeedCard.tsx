import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  feedPackLabel,
  feedVisibleTags,
  type HomeFeedCreator,
} from "@/services/creatorFeed";

export function CreatorFeedCard({
  item,
  active,
  onLike,
  onBuy,
  onOpenCreator,
  videoRef,
}: {
  item: HomeFeedCreator;
  active: boolean;
  onLike: () => void;
  onBuy: () => void;
  onOpenCreator?: (creatorId: string) => void;
  videoRef: (node: HTMLVideoElement | null) => void;
}) {
  const [burst, setBurst] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const tags = feedVisibleTags(item.tags);
  const packLabel = feedPackLabel(item.packName);
  const canOpenCreator = Boolean(item.creatorId && onOpenCreator);

  function like() {
    onLike();
    if (!item.liked && !reducedMotion) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 480);
    }
  }

  return (
    <article
      className="hf-card"
      aria-label={`${item.creatorName} · ${packLabel}`}
    >
      <div className={["hf-media", active ? "is-active" : ""].join(" ")}>
        {item.mediaType === "video" && item.videoUrl ? (
          <video
            ref={videoRef}
            src={item.videoUrl}
            poster={item.posterUrl}
            playsInline
            muted
            loop
            autoPlay={active}
            preload={active ? "auto" : "metadata"}
            className="hf-media-el hf-media-video"
          />
        ) : (
          <img
            src={item.posterUrl}
            alt=""
            className="hf-media-el hf-media-still"
            draggable={false}
          />
        )}
        <div className="hf-media-shade" aria-hidden="true" />
      </div>

      <div className={["hf-overlay", active ? "is-visible" : ""].join(" ")}>
        <div className="hf-info">
          {canOpenCreator ? (
            <button
              type="button"
              className="hf-creator hf-creator--link"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreator?.(item.creatorId);
              }}
            >
              {item.creatorName}
            </button>
          ) : (
            <h2 className="hf-creator">{item.creatorName}</h2>
          )}
          <p className="hf-pack">{packLabel}</p>
          {tags.length > 0 ? (
            <ul className="hf-tags" aria-label="Pack tags">
              {tags.map((tag) => (
                <li key={tag} className="hf-tag">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="hf-actions">
          <button
            type="button"
            className="hf-buy"
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
            aria-label={`Buy Pack for ${item.diamondCost} diamonds`}
          >
            <span>Buy Pack</span>
            <span className="hf-buy-price">💎{item.diamondCost}</span>
          </button>

          <button
            type="button"
            className={[
              "hf-like",
              item.liked ? "is-liked" : "",
              burst ? "is-burst" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={item.liked ? "Unlike" : "Like"}
            aria-pressed={item.liked}
            onClick={(e) => {
              e.stopPropagation();
              like();
            }}
          >
            <Heart
              className="hf-like-icon"
              fill={item.liked ? "currentColor" : "none"}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {burst ? <span className="hf-like-burst" aria-hidden="true" /> : null}
          </button>
        </div>
      </div>
    </article>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Keep a stable video ref callback without re-registering every render. */
export function useVideoRegistry() {
  const mapRef = useRef(new Map<string, HTMLVideoElement>());
  return mapRef;
}
