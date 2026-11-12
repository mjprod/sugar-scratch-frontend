import {
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import "@/components/motion-card/MotionCard.css";
import "@/features/packs/packs.css";
import "@/features/packs/packs-entry.css";

/** Same box as the portaled Buy Pack confirm. Pixels, not rem:
 * the creator page root is 12px, so 14.25rem would undershoot 228×158. */
const PLAY_CONFIRM_WIDTH = 228;
const PLAY_CONFIRM_HEIGHT = 158;
const LEAVE_ANIMATIONS = new Set([
  "coverflow-confirm-leave",
  "coverflow-buy-confirm-leave",
]);

/** Resolve the rect we pin to, and whether to prefer opening upward. */
function anchorPlacement(anchor: HTMLElement): {
  rect: DOMRect;
  preferAbove: boolean;
} {
  // Photo grid CTAs sit on the lower fold — pin to the button and open up.
  if (anchor.closest(".mcp-photo-play-cta")) {
    return { rect: anchor.getBoundingClientRect(), preferAbove: true };
  }
  const card = anchor.closest(".static-card-holder__face, .mcp-photo-cell");
  if (card) {
    return {
      rect: card.getBoundingClientRect(),
      preferAbove: Boolean(anchor.closest(".mcp-photo-cell")),
    };
  }
  const ctaHost = anchor.closest(
    ".coverflow-compact-play-cta, .cpv2-motion-tile-play-cta, .motion-card-holder__play",
  );
  return {
    rect: (ctaHost ?? anchor).getBoundingClientRect(),
    preferAbove: false,
  };
}

export function PlayConfirm({
  anchor,
  playCost,
  label = "Play Photo Card?",
  leaving = false,
  onCancel,
  onConfirm,
  onLeaveEnd,
}: {
  anchor: HTMLElement;
  playCost: number;
  label?: string;
  leaving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onLeaveEnd?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const [box, setBox] = useState<{
    top: number;
    left: number;
    arrow: number;
    above: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const { rect, preferAbove } = anchorPlacement(anchor);
      const margin = 12;
      const gap = 8;
      const half = PLAY_CONFIRM_WIDTH / 2;
      const center = rect.left + rect.width / 2;
      // visualViewport: a transformed overlay (scale-in) can make
      // window.innerWidth larger than the box the user actually sees.
      const view = window.visualViewport;
      const viewLeft = view?.offsetLeft ?? 0;
      const viewTop = view?.offsetTop ?? 0;
      const viewWidth = view?.width ?? window.innerWidth;
      const viewHeight = view?.height ?? window.innerHeight;
      const minLeft = viewLeft + margin + half;
      const maxLeft = viewLeft + viewWidth - margin - half;
      const left = Math.min(
        Math.max(center, minLeft),
        Math.max(minLeft, maxLeft),
      );
      const arrow = Math.min(
        PLAY_CONFIRM_WIDTH - 16,
        Math.max(16, center - (left - half)),
      );
      const spaceBelow = viewTop + viewHeight - rect.bottom - gap;
      const spaceAbove = rect.top - viewTop - gap;
      const above =
        preferAbove ||
        (spaceBelow < PLAY_CONFIRM_HEIGHT && spaceAbove > spaceBelow);
      const rawTop = above
        ? rect.top - PLAY_CONFIRM_HEIGHT - gap
        : rect.bottom + gap;
      const top = Math.min(
        Math.max(rawTop, viewTop + margin),
        viewTop + viewHeight - PLAY_CONFIRM_HEIGHT - margin,
      );
      setBox({ top, left, arrow, above });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    const view = window.visualViewport;
    view?.addEventListener("resize", place);
    view?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      view?.removeEventListener("resize", place);
      view?.removeEventListener("scroll", place);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onCancelRef.current();
    };
    // iOS often delivers a trailing pointer from the opening tap — wait out the
    // click synthesis window before listening for outside dismiss.
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 350);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor]);

  function handleLeaveEnd(event: ReactAnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!LEAVE_ANIMATIONS.has(event.animationName)) return;
    onLeaveEnd?.();
  }

  return createPortal(
    <div
      ref={ref}
      className={[
        "coverflow-cart-remove-confirm",
        "static-card-buy-confirm",
        "is-anchored",
        box?.above ? "is-above" : "",
        leaving ? "is-leaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="dialog"
      aria-label={`${label.replace(/\?$/, "")} for ${playCost} diamonds?`}
      aria-modal="false"
      style={{
        position: "fixed",
        top: box?.top ?? 0,
        left: box?.left ?? 0,
        width: PLAY_CONFIRM_WIDTH,
        minWidth: PLAY_CONFIRM_WIDTH,
        height: PLAY_CONFIRM_HEIGHT,
        zIndex: 5200,
        visibility: box ? "visible" : "hidden",
        ["--play-confirm-arrow" as string]: `${box?.arrow ?? PLAY_CONFIRM_WIDTH / 2}px`,
      }}
      onAnimationEnd={handleLeaveEnd}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="static-card-buy-confirm__body">
        <p className="coverflow-cart-remove-confirm__label static-card-buy-confirm__label">
          <span>{label}</span>
          <DiamondLottie size={18} aria-hidden />
          <span className="static-card-buy-confirm__price">{playCost}</span>
        </p>
        <div className="coverflow-cart-remove-confirm__actions">
          <button
            type="button"
            className="coverflow-cart-remove-confirm__btn is-cancel"
            aria-label="No"
            onClick={onCancel}
          >
            <X aria-hidden="true" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="coverflow-cart-remove-confirm__btn is-confirm is-yes"
            aria-label="Yes"
            onClick={onConfirm}
          >
            <Check aria-hidden="true" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
