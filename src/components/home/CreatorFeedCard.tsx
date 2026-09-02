import { Heart } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CtaButton,
  ctaButtonPropsFromTemplate,
} from "@/components/cta";
import { useAuth } from "@/contexts/AuthContext";
import {
  feedLikeCount,
  feedPackLabel,
  feedVisibleTags,
  formatFeedLikeCount,
  type HomeFeedCreator,
} from "@/services/creatorFeed";
import {
  followCreator,
  isFollowing,
  unfollowCreator,
} from "@/services/following";

const DOUBLE_TAP_MS = 280;
const TAP_MOVE_PX = 14;
const DOUBLE_TAP_SLOP_PX = 28;

type BurstMode = "media" | "button";
type HeartDepth = "fg" | "mid" | "bg";

type HeartBurst = {
  id: number;
  x: number;
  y: number;
  mode: BurstMode;
  cardW: number;
  secondaries: SecondaryHeart[];
};

type SecondaryHeart = {
  dx: number;
  dy: number;
  sizePx: number;
  delayMs: number;
  opacity: number;
  depth: HeartDepth;
};

/** Wide double-tap spread — inner / mid / outer rings (asymmetric). */
const MEDIA_SECONDARY_POOL: SecondaryHeart[] = [
  /* Inner */
  { dx: -70, dy: -56, sizePx: 48, delayMs: 18, opacity: 0.9, depth: "fg" },
  { dx: 74, dy: -44, sizePx: 44, delayMs: 32, opacity: 0.86, depth: "fg" },
  { dx: -36, dy: 66, sizePx: 40, delayMs: 46, opacity: 0.82, depth: "mid" },
  /* Mid */
  { dx: -138, dy: -118, sizePx: 56, delayMs: 40, opacity: 0.8, depth: "mid" },
  { dx: 152, dy: -98, sizePx: 50, delayMs: 58, opacity: 0.78, depth: "mid" },
  { dx: -158, dy: 48, sizePx: 46, delayMs: 72, opacity: 0.74, depth: "mid" },
  { dx: 142, dy: 78, sizePx: 54, delayMs: 86, opacity: 0.76, depth: "mid" },
  /* Outer */
  { dx: -198, dy: -168, sizePx: 34, delayMs: 64, opacity: 0.56, depth: "bg" },
  { dx: 212, dy: -150, sizePx: 30, delayMs: 80, opacity: 0.52, depth: "bg" },
  { dx: -18, dy: -220, sizePx: 36, delayMs: 50, opacity: 0.58, depth: "bg" },
  { dx: 188, dy: 132, sizePx: 32, delayMs: 100, opacity: 0.48, depth: "bg" },
  { dx: -176, dy: 148, sizePx: 28, delayMs: 112, opacity: 0.46, depth: "bg" },
];

/** Button burst — moderate primary + noticeably wider small satellites. */
const BUTTON_SECONDARIES: SecondaryHeart[] = [
  { dx: -62, dy: -74, sizePx: 28, delayMs: 16, opacity: 0.8, depth: "fg" },
  { dx: 68, dy: -58, sizePx: 24, delayMs: 30, opacity: 0.72, depth: "mid" },
  { dx: -78, dy: 30, sizePx: 22, delayMs: 44, opacity: 0.6, depth: "bg" },
  { dx: 76, dy: 40, sizePx: 26, delayMs: 58, opacity: 0.66, depth: "mid" },
  { dx: 6, dy: -92, sizePx: 20, delayMs: 36, opacity: 0.55, depth: "bg" },
];

export function CreatorFeedCard({
  item,
  active,
  /** Eager-buffer neighbor cards (next peek / previous) so they aren't black. */
  warm = false,
  onLike,
  onEnsureLike,
  onBuy,
  onOpenCreator,
  videoRef,
  buyCta = "squircleCTA",
}: {
  item: HomeFeedCreator;
  active: boolean;
  warm?: boolean;
  onLike: () => void;
  /** One-way Like for media double-tap. Return false when auth/modal blocks. */
  onEnsureLike: () => boolean;
  onBuy: () => void;
  onOpenCreator?: (creatorId: string) => void;
  videoRef: (node: HTMLVideoElement | null) => void;
  buyCta?: "squircleCTA" | "pillGoldCTA";
}) {
  const { requireAuth, authed } = useAuth();
  const [burst, setBurst] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [heartBurst, setHeartBurst] = useState<HeartBurst | null>(null);
  const [following, setFollowing] = useState(() =>
    isFollowing(item.creatorId),
  );
  const reducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const likeBtnRef = useRef<HTMLButtonElement>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const likedViaTapRef = useRef(0);
  const burstIdRef = useRef(0);
  const tags = feedVisibleTags(item.tags);
  const packLabel = feedPackLabel(item.packName);
  const likeCountLabel = formatFeedLikeCount(
    feedLikeCount(item.creatorId, item.liked),
  );
  const canOpenCreator = Boolean(item.creatorId && onOpenCreator);
  const shouldBuffer = active || warm;
  const videoKey = item.videoUrl || item.id;

  useEffect(() => {
    setFollowing(isFollowing(item.creatorId));
  }, [item.creatorId]);

  function handleToggleFollow(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const creatorId = item.creatorId.trim();
    if (!creatorId) return;
    // Same gate as Like: guests open auth; never resume a navigation action.
    if (!authed) {
      requireAuth({
        type: "follow",
        creatorId,
        displayName: item.creatorName,
        avatarUrl: item.avatarUrl || "/img/placeholder.png",
      });
      return;
    }

    if (following) {
      unfollowCreator(creatorId);
      setFollowing(false);
      return;
    }

    followCreator({
      id: creatorId,
      displayName: item.creatorName,
      username: "",
      avatarUrl: item.avatarUrl || "/img/placeholder.png",
      followedAt: Date.now(),
      hasUnseenActivity: false,
    });
    setFollowing(true);
  }
  /**
   * Keep CTA shader motion alive across the mid-scroll handoff.
   * `active` flips at ~50% slide travel (Math.round), so gating aurora on
   * active-only makes the leaving card drop WebGL particles/aurora too early.
   * Warm neighbors stay in view during that transition — keep them live too.
   */
  const ctaMotionLive = (active || warm) && !reducedMotion;

  useEffect(() => {
    setMediaReady(false);
  }, [videoKey]);

  function markVideoReady(video: HTMLVideoElement) {
    if (!item.videoUrl) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!video.currentSrc) return;
    setMediaReady(true);
  }

  function playHeartBurst(mode: BurstMode, clientX?: number, clientY?: number) {
    const root = cardRef.current;
    if (!root) return;

    const cardRect = root.getBoundingClientRect();
    let x: number;
    let y: number;

    if (
      mode === "button" &&
      likeBtnRef.current &&
      (clientX == null || clientY == null)
    ) {
      const btn = likeBtnRef.current.getBoundingClientRect();
      x = btn.left + btn.width / 2 - cardRect.left;
      y = btn.top + btn.height / 2 - cardRect.top;
    } else {
      x = (clientX ?? cardRect.left + cardRect.width / 2) - cardRect.left;
      y = (clientY ?? cardRect.top + cardRect.height / 2) - cardRect.top;
    }

    const origin = softClampOrigin(x, y, cardRect.width, cardRect.height);
    const id = ++burstIdRef.current;
    const secondaries =
      mode === "button"
        ? fitSecondaries(
            BUTTON_SECONDARIES,
            origin.x,
            origin.y,
            cardRect.width,
            cardRect.height,
            0.9,
          )
        : pickMediaSecondaries(
            id,
            origin.x,
            origin.y,
            cardRect.width,
            cardRect.height,
          );

    setHeartBurst({
      id,
      x: origin.x,
      y: origin.y,
      mode,
      cardW: cardRect.width,
      secondaries,
    });

    if (!reducedMotion) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 480);
    }

    const maxDelay = secondaries.reduce(
      (m, piece) => Math.max(m, piece.delayMs),
      0,
    );
    const baseDurationMs = reducedMotion ? 420 : mode === "button" ? 850 : 1000;
    const ttl = baseDurationMs + maxDelay + 80;
    window.setTimeout(() => {
      setHeartBurst((prev) => (prev?.id === id ? null : prev));
    }, ttl);
  }

  function like() {
    onLike();
    if (!item.liked) {
      playHeartBurst("button");
    }
  }

  function handleDoubleTapLike(clientX: number, clientY: number) {
    if (!active || gestureLayerBlocked()) return;
    if (!onEnsureLike()) return;
    likedViaTapRef.current = performance.now();
    playHeartBurst("media", clientX, clientY);
  }

  function onCardDoubleClick(e: ReactMouseEvent<HTMLElement>) {
    if (isExcludedControl(e.target)) return;
    if (performance.now() - likedViaTapRef.current < 400) return;
    handleDoubleTapLike(e.clientX, e.clientY);
  }

  function onCardPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  }

  function onCardPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if (!active) {
      lastTapRef.current = null;
      pointerDownRef.current = null;
      return;
    }
    if (isExcludedControl(e.target)) {
      lastTapRef.current = null;
      pointerDownRef.current = null;
      return;
    }
    if (gestureLayerBlocked()) {
      lastTapRef.current = null;
      pointerDownRef.current = null;
      return;
    }

    const down = pointerDownRef.current;
    pointerDownRef.current = null;
    if (
      down &&
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_MOVE_PX
    ) {
      lastTapRef.current = null;
      return;
    }

    const now = performance.now();
    const last = lastTapRef.current;
    if (
      last &&
      now - last.t <= DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) <= DOUBLE_TAP_SLOP_PX
    ) {
      lastTapRef.current = null;
      handleDoubleTapLike(e.clientX, e.clientY);
      return;
    }

    lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
  }

  function onCardPointerCancel() {
    pointerDownRef.current = null;
    lastTapRef.current = null;
  }

  return (
    <article
      ref={cardRef}
      className="hf-card"
      aria-label={`${item.creatorName} · ${packLabel}`}
      onPointerDown={onCardPointerDown}
      onPointerUp={onCardPointerUp}
      onPointerCancel={onCardPointerCancel}
      onDoubleClick={onCardDoubleClick}
    >
      <div className={["hf-media", active ? "is-active" : ""].join(" ")}>
        {item.mediaType === "video" && item.videoUrl ? (
          <>
            {item.swipePosterUrl ? (
              <img
                src={item.swipePosterUrl}
                alt=""
                aria-hidden="true"
                className="hf-media-el hf-media-poster"
              />
            ) : !mediaReady ? (
              <div
                className="hf-media-el hf-media-poster hf-media-poster--idle"
                aria-hidden="true"
              />
            ) : null}
            <video
              key={videoKey}
              ref={videoRef}
              src={item.videoUrl}
              playsInline
              muted
              loop
              autoPlay={active}
              preload={shouldBuffer ? "auto" : "metadata"}
              className={[
                "hf-media-el hf-media-video",
                mediaReady ? "is-ready" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onLoadStart={() => setMediaReady(false)}
              onEmptied={() => setMediaReady(false)}
              onLoadedData={(event) => markVideoReady(event.currentTarget)}
              onCanPlay={(event) => markVideoReady(event.currentTarget)}
              onPlaying={(event) => markVideoReady(event.currentTarget)}
            />
          </>
        ) : null}
        <div className="hf-media-shade" aria-hidden="true" />
      </div>

      {heartBurst ? (
        <div
          className={[
            "hf-heart-burst",
            `hf-heart-burst--${heartBurst.mode}`,
            reducedMotion ? "is-reduced" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            {
              left: heartBurst.x,
              top: heartBurst.y,
              "--hf-card-w": `${heartBurst.cardW}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <span className="hf-heart-burst-piece is-primary is-depth-fg">
            <CandyHeart className="hf-candy-heart" />
          </span>
          {heartBurst.secondaries.map((piece, index) => (
            <span
              key={`${heartBurst.id}-${index}`}
              className={`hf-heart-burst-piece is-secondary is-depth-${piece.depth}`}
              style={
                {
                  "--hf-hx": `${piece.dx}px`,
                  "--hf-hy": `${piece.dy}px`,
                  "--hf-hsz": `${piece.sizePx}px`,
                  "--hf-hd": `${piece.delayMs}ms`,
                  "--hf-ho": piece.opacity,
                } as CSSProperties
              }
            >
              <CandyHeart className="hf-candy-heart" soft={piece.depth === "bg"} />
            </span>
          ))}
        </div>
      ) : null}

      <div className={["hf-overlay", active ? "is-visible" : ""].join(" ")}>
        <div className="hf-info">
          <div className="hf-name-row">
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
            <button
              type="button"
              className={[
                "hf-follow",
                following ? "is-following" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={following}
              aria-label={following ? "Unfollow" : "Follow"}
              data-no-feed-drag
              onClick={handleToggleFollow}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              {following ? "Following" : "Follow"}
            </button>
          </div>
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
          <div className="hf-buy">
            <CtaButton
              {...ctaButtonPropsFromTemplate(buyCta)}
              fillParent
              label="Buy Pack"
              costAmount={item.diamondCost}
              fontSize={15}
              /* Hairline on-button ring (iOS-safe stroke layer). */
              strokeWidth={1}
              /*
                Viewport-scoped motion:
                - active + warm neighbors: aurora / particles / orbit
                  (warm covers the ~50–100% scroll handoff on desktop)
                - far slides: static CTA only
                - diamond Lottie stays active-only (heavier wasm loop)
              */
              glowOuterBloom={ctaMotionLive ? "lite" : "off"}
              glowAlwaysOn={ctaMotionLive}
              auroraPaused={!ctaMotionLive}
              costIconAnimated={active && !reducedMotion}
              aria-label={`Buy Pack for ${item.diamondCost} diamonds`}
              onClick={(e) => {
                e.stopPropagation();
                onBuy();
              }}
            />
          </div>

          <div className="hf-like-wrap">
            <button
              ref={likeBtnRef}
              type="button"
              className={[
                "hf-like",
                item.liked ? "is-liked" : "",
                burst ? "is-burst" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={
                item.liked
                  ? `Unlike · ${likeCountLabel} likes`
                  : `Like · ${likeCountLabel} likes`
              }
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
              {burst ? (
                <span className="hf-like-burst" aria-hidden="true" />
              ) : null}
            </button>
            <span className="hf-like-caption" aria-hidden="true">
              {likeCountLabel}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Soft candy heart — dimensional gradient + highlight, not a flat icon. */
function CandyHeart({
  className,
  soft = false,
}: {
  className?: string;
  soft?: boolean;
}) {
  const rawId = useId().replace(/:/g, "");
  const fillId = `hf-heart-fill-${rawId}`;
  const shineId = `hf-heart-shine-${rawId}`;
  const edgeId = `hf-heart-edge-${rawId}`;

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={fillId} x1="14%" y1="6%" x2="86%" y2="94%">
          <stop offset="0%" stopColor={soft ? "oklch(0.848 0.097 351.66)" : "oklch(0.876 0.077 351.45)"} />
          <stop offset="38%" stopColor="oklch(0.692 0.223 356.89)" />
          <stop offset="72%" stopColor="oklch(0.656 0.212 354.31)" />
          <stop offset="100%" stopColor="oklch(0.508 0.188 355.38)" />
        </linearGradient>
        <radialGradient id={shineId} cx="34%" cy="26%" r="42%">
          <stop offset="0%" stopColor="oklch(1 0 0 / 0.58)" />
          <stop offset="45%" stopColor="oklch(1 0 0 / 0.12)" />
          <stop offset="100%" stopColor="oklch(1 0 0 / 0)" />
        </radialGradient>
        <linearGradient id={edgeId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.869 0.083 349.64 / 0.55)" />
          <stop offset="100%" stopColor="oklch(0.508 0.188 355.38 / 0.15)" />
        </linearGradient>
      </defs>
      <path
        d="M32 56.2C14.8 43.4 6 32.8 6 21.6 6 13.2 12.4 7 20.4 7c5.2 0 9.4 2.8 11.6 7.2C34.2 9.8 38.4 7 43.6 7 51.6 7 58 13.2 58 21.6c0 11.2-8.8 21.8-26 34.6Z"
        fill={`url(#${fillId})`}
        stroke={`url(#${edgeId})`}
        strokeWidth="1.2"
      />
      <path
        d="M32 56.2C14.8 43.4 6 32.8 6 21.6 6 13.2 12.4 7 20.4 7c5.2 0 9.4 2.8 11.6 7.2C34.2 9.8 38.4 7 43.6 7 51.6 7 58 13.2 58 21.6c0 11.2-8.8 21.8-26 34.6Z"
        fill={`url(#${shineId})`}
      />
    </svg>
  );
}

function pickMediaSecondaries(
  burstId: number,
  originX: number,
  originY: number,
  mediaWidth: number,
  mediaHeight: number,
): SecondaryHeart[] {
  const count = 7 + (burstId % 5); // 7–11
  const scale = mediaWidth < 360 ? 0.84 : mediaWidth < 420 ? 0.94 : 1;
  const scaled = MEDIA_SECONDARY_POOL.slice(0, count).map((piece) => ({
    ...piece,
    dx: Math.round(piece.dx * scale),
    dy: Math.round(piece.dy * scale),
    sizePx: Math.round(piece.sizePx * scale),
  }));
  return fitSecondaries(scaled, originX, originY, mediaWidth, mediaHeight, 1);
}

/** Soft origin nudge only — keep tap feel; clamp individual trajectories instead. */
function softClampOrigin(x: number, y: number, width: number, height: number) {
  const padX = Math.min(48, width * 0.12);
  const padY = Math.min(64, height * 0.1);
  return {
    x: Math.min(Math.max(x, padX), Math.max(padX, width - padX)),
    y: Math.min(Math.max(y, padY), Math.max(padY, height - padY)),
  };
}

/** Shrink only hearts that would leave the media — don't shrink the whole burst. */
function fitSecondaries(
  pieces: SecondaryHeart[],
  originX: number,
  originY: number,
  width: number,
  height: number,
  travelScale: number,
): SecondaryHeart[] {
  return pieces.map((piece) => {
    const dx0 = piece.dx * travelScale;
    const dy0 = piece.dy * travelScale;
    const pad = piece.sizePx / 2 + 8;
    let scale = 1;

    if (dx0 !== 0) {
      if (originX + dx0 < pad) scale = Math.min(scale, (pad - originX) / dx0);
      if (originX + dx0 > width - pad) {
        scale = Math.min(scale, (width - pad - originX) / dx0);
      }
    }
    if (dy0 !== 0) {
      if (originY + dy0 < pad) scale = Math.min(scale, (pad - originY) / dy0);
      if (originY + dy0 > height - pad) {
        scale = Math.min(scale, (height - pad - originY) / dy0);
      }
    }

    scale = Math.max(0.32, Math.min(1, scale));
    return {
      ...piece,
      dx: Math.round(dx0 * scale),
      dy: Math.round(dy0 * scale),
    };
  });
}

function isExcludedControl(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, a, input, textarea, select, [role="button"], [role="link"]',
      ),
    )
  );
}

function gestureLayerBlocked() {
  return Boolean(
    document.querySelector(
      '[aria-modal="true"], [role="dialog"][aria-modal="true"]',
    ),
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
