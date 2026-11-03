import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

const CLICK_SWALLOW_MS = 500;

export type ConvertTouchPhase = "idle" | "preview";

/** Pure touch state machine — kept out of the hook so self-check can run it. */
export function nextConvertTouchPhase(
  phase: ConvertTouchPhase,
  event: "tap-button" | "tap-away" | "reset",
): { phase: ConvertTouchPhase; convert: boolean } {
  if (event === "reset" || event === "tap-away") {
    return { phase: "idle", convert: false };
  }
  if (phase === "idle") {
    return { phase: "preview", convert: false };
  }
  return { phase: "idle", convert: true };
}

function isConvertSafeTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-convert-confirm]")) return true;
  return false;
}

/**
 * Mouse: hover previews, click confirms when affordable.
 * Touch: first tap previews, second tap (arrow or preview) confirms; tap away cancels.
 * Preview still works when short on Coins (caller shows a denied × amount).
 */
export function useConvertPress(
  canPreview: boolean,
  onConfirm: () => void,
  canConvert = canPreview,
) {
  const handledTouchRef = useRef(false);
  const swallowRef = useRef<((event: Event) => void) | null>(null);
  const swallowTimerRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const touchPhaseRef = useRef<ConvertTouchPhase>("idle");
  const canPreviewRef = useRef(canPreview);
  const canConvertRef = useRef(canConvert);
  const onConfirmRef = useRef(onConfirm);
  canPreviewRef.current = canPreview;
  canConvertRef.current = canConvert;
  onConfirmRef.current = onConfirm;
  const [preview, setPreview] = useState(false);

  const disarmClickSwallow = () => {
    const swallow = swallowRef.current;
    if (swallow) {
      document.removeEventListener("click", swallow, true);
      swallowRef.current = null;
    }
    window.clearTimeout(swallowTimerRef.current);
    swallowTimerRef.current = 0;
  };

  const armClickSwallow = () => {
    disarmClickSwallow();
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      disarmClickSwallow();
    };
    swallowRef.current = swallow;
    document.addEventListener("click", swallow, true);
    swallowTimerRef.current = window.setTimeout(
      disarmClickSwallow,
      CLICK_SWALLOW_MS,
    );
  };

  const clearPreview = () => {
    touchPhaseRef.current = "idle";
    handledTouchRef.current = false;
    disarmClickSwallow();
    setPreview(false);
  };

  /** Confirm from the preview label / amount (or a second intentional action). */
  const confirmPreview = () => {
    if (!canConvertRef.current) return false;
    clearPreview();
    onConfirmRef.current();
    return true;
  };

  useEffect(() => {
    if (!canPreview) clearPreview();
  }, [canPreview]);

  useEffect(
    () => () => {
      disarmClickSwallow();
    },
    [],
  );

  // Pointer down outside the arrow / preview confirm cancels (no transfer).
  useEffect(() => {
    if (!preview) return;

    const onPointerDown = (event: Event) => {
      if (!(event instanceof PointerEvent)) return;
      const target = event.target;
      if (isConvertSafeTarget(target)) return;
      const button = buttonRef.current;
      if (button && target instanceof Node && button.contains(target)) return;
      clearPreview();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [preview]);

  const applyTouchTap = (event: PointerEvent<HTMLButtonElement>) => {
    const node = document.elementFromPoint(event.clientX, event.clientY);
    if (node && !event.currentTarget.contains(node)) return;

    const next = nextConvertTouchPhase(touchPhaseRef.current, "tap-button");
    handledTouchRef.current = true;
    armClickSwallow();

    if (next.convert) {
      if (!canConvertRef.current) {
        touchPhaseRef.current = "preview";
        setPreview(true);
        return;
      }
      touchPhaseRef.current = "idle";
      setPreview(false);
      onConfirmRef.current();
      return;
    }

    touchPhaseRef.current = "preview";
    setPreview(true);
  };

  return {
    preview,
    clearPreview,
    confirmPreview,
    convertButtonProps: {
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        if (!canPreviewRef.current) return;
        if (event.pointerType !== "mouse") return;
        if (event.buttons !== 0) return;
        setPreview(true);
      },
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (!canPreviewRef.current) return;
        buttonRef.current = event.currentTarget;
        handledTouchRef.current = false;
        if (event.pointerType === "mouse") {
          setPreview(true);
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse") return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (!canPreviewRef.current) return;
        applyTouchTap(event);
      },
      onPointerCancel: () => {
        handledTouchRef.current = false;
      },
      onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== "mouse") return;
        // Sticky after a touch preview; allow moving onto the preview confirm.
        if (touchPhaseRef.current === "preview") return;
        if (isConvertSafeTarget(event.relatedTarget)) return;
        setPreview(false);
      },
      onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const handledTouch = handledTouchRef.current;
        handledTouchRef.current = false;
        if (handledTouch || !canPreviewRef.current) return;
        if (!canConvertRef.current) return;
        onConfirmRef.current();
      },
    },
  };
}
