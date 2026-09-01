import {
  DotLottieReact,
  type DotLottie,
} from "@lottiefiles/dotlottie-react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  countCartPacks,
  subscribeCart,
  subscribeCartRemoveIntent,
} from "@/services/cart";
import { lottieRenderConfig } from "@/utils/lottieRender";

type PocketFxDirection = "forward" | "reverse";

const ADDED_LOTTIE_SRC = "/lottie/iconAdded.lottie";
/** iconAdded.lottie is 60 frames @ 60fps. Add plays 1.25×; remove plays reverse at 1.5×. */
const ADDED_LOTTIE_SPEED = 1.25;
const ADDED_LOTTIE_MS = 920;
const REMOVED_LOTTIE_SPEED = 1.5;
const REMOVED_LOTTIE_MS = 780;

/**
 * Global HUD utility control — cart for packs to open (TopNav / mobile utility).
 * Unread inbox count uses {@link InboxUtilityBadge} on the Profile icon.
 */
export function InboxUtilityBadge({
  count = 0,
  bump = false,
  tone = "inbox",
}: {
  count?: number;
  bump?: boolean;
  tone?: "pack" | "inbox";
}) {
  if (count <= 0) return null;
  const badgeLabel = count > 9 ? "9+" : String(count);
  return (
    <span
      className={[
        "inbox-utility-badge",
        tone === "pack"
          ? "inbox-utility-badge--pack"
          : "inbox-utility-badge--inbox",
        bump ? "is-bumping" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {badgeLabel}
    </span>
  );
}

function usePackPocketCount() {
  const [count, setCount] = useState(() =>
    typeof window === "undefined" ? 0 : countCartPacks(),
  );

  useEffect(() => {
    setCount(countCartPacks());
    return subscribeCart(() => setCount(countCartPacks()));
  }, []);

  return count;
}

function CartOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <path d="m9 10.25l3 3l3-3" />
        <path d="M4.8 3h14.4c.477 0 .935.199 1.273.553S21 4.388 21 4.89v6.667c0 2.504-.948 4.907-2.636 6.678S14.387 21 12 21a8.6 8.6 0 0 1-3.444-.719a9 9 0 0 1-2.92-2.047C3.948 16.463 3 14.06 3 11.556V4.889c0-.501.19-.982.527-1.336A1.76 1.76 0 0 1 4.8 3" />
      </g>
    </svg>
  );
}

export const PacksButton = forwardRef<
  HTMLButtonElement,
  {
    onOpen: () => void;
    className?: string;
    /** surface = bordered circle (subpage headers); ghost = compact HUD (TopNav). */
    variant?: "surface" | "ghost";
    /** Active while the cart page is open. */
    active?: boolean;
    /** Mobile top-nav bubble drag target marker. */
    "data-top-nav-target"?: string;
  }
>(function PacksButton(
  {
    onOpen,
    className = "",
    variant = "surface",
    active = false,
    "data-top-nav-target": topNavTarget,
  },
  ref,
) {
  const packCount = usePackPocketCount();
  const previousCountRef = useRef(packCount);
  const playerRef = useRef<DotLottie | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const [bumpId, setBumpId] = useState(0);
  const [fxVisible, setFxVisible] = useState(false);
  const [fxDirection, setFxDirection] = useState<PocketFxDirection>("forward");

  const prefersReducedMotion = useCallback(() => {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  const playPocketFx = useCallback(
    (direction: PocketFxDirection) => {
      if (prefersReducedMotion()) return;
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setFxDirection(direction);
      setFxVisible(true);

      const player = playerRef.current;
      if (player?.isLoaded) {
        player.setMode(direction);
        player.setSpeed(
          direction === "reverse" ? REMOVED_LOTTIE_SPEED : ADDED_LOTTIE_SPEED,
        );
        const lastFrame = Math.max(0, player.totalFrames - 1);
        player.setFrame(direction === "reverse" ? lastFrame : 0);
        player.play();
      }

      hideTimeoutRef.current = window.setTimeout(
        () => {
          setFxVisible(false);
          hideTimeoutRef.current = null;
        },
        direction === "reverse" ? REMOVED_LOTTIE_MS : ADDED_LOTTIE_MS,
      );
    },
    [prefersReducedMotion],
  );

  const handlePlayer = useCallback((player: DotLottie | null) => {
    playerRef.current = player;
    if (!player) return;
    const ready = () => {
      player.setLoop(false);
    };
    if (player.isLoaded) ready();
    else player.addEventListener("load", ready);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previous = previousCountRef.current;
    if (packCount === previous) return;

    if (packCount > previous) {
      setBumpId((id) => id + 1);
      playPocketFx("forward");
    }

    previousCountRef.current = packCount;
  }, [packCount, playPocketFx]);

  useEffect(() => subscribeCartRemoveIntent(() => playPocketFx("reverse")), [
    playPocketFx,
  ]);

  const surfaceClasses =
    "inbox-utility-btn relative grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95";
  const ghostClasses =
    "inbox-utility-btn inbox-utility-btn--ghost relative grid size-7 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/85 active:scale-95";

  const ariaLabel =
    packCount > 0
      ? `Pack Pocket, ${packCount} pack${packCount === 1 ? "" : "s"}`
      : "Pack Pocket";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      data-top-nav-target={topNavTarget}
      className={[
        variant === "ghost" ? ghostClasses : surfaceClasses,
        active ? "is-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className="inbox-utility-added-fx"
        aria-hidden="true"
        style={{ visibility: fxVisible ? "visible" : "hidden" }}
      >
        <DotLottieReact
          src={ADDED_LOTTIE_SRC}
          autoplay={false}
          loop={false}
          mode={fxDirection}
          speed={
            fxDirection === "reverse"
              ? REMOVED_LOTTIE_SPEED
              : ADDED_LOTTIE_SPEED
          }
          renderConfig={lottieRenderConfig()}
          dotLottieRefCallback={handlePlayer}
          style={{ width: "100%", height: "100%" }}
        />
      </span>
      <CartOutlineIcon className="inbox-utility-icon h-full w-full" />
      <InboxUtilityBadge
        key={bumpId}
        count={packCount}
        bump={bumpId > 0}
        tone="pack"
      />
    </button>
  );
});
