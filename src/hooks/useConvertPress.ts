import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

const HOLD_MS = 280;
const CLICK_SWALLOW_MS = 500;

/**
 * Circle convert: hover/hold previews, tap converts, hold-release does nothing.
 * iOS does not synthesize click after setPointerCapture — convert on pointerup.
 */
export function useConvertPress(canConvert: boolean, onTap: () => void) {
  const heldRef = useRef(false);
  const tappedRef = useRef(false);
  const timerRef = useRef(0);
  const swallowRef = useRef<((event: Event) => void) | null>(null);
  const swallowTimerRef = useRef(0);
  const canConvertRef = useRef(canConvert);
  const onTapRef = useRef(onTap);
  canConvertRef.current = canConvert;
  onTapRef.current = onTap;
  const [preview, setPreview] = useState(false);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      const swallow = swallowRef.current;
      if (swallow) document.removeEventListener("click", swallow, true);
      window.clearTimeout(swallowTimerRef.current);
    },
    [],
  );

  const stopTouchHold = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    setPreview(false);
  };

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

  const convertFromTouch = (event: PointerEvent<HTMLButtonElement>) => {
    const node = document.elementFromPoint(event.clientX, event.clientY);
    if (node && !event.currentTarget.contains(node)) return;
    tappedRef.current = true;
    armClickSwallow();
    onTapRef.current();
  };

  return {
    preview,
    clearPreview: () => {
      heldRef.current = false;
      tappedRef.current = false;
      disarmClickSwallow();
      stopTouchHold();
    },
    convertButtonProps: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (!canConvertRef.current) return;
        heldRef.current = false;
        tappedRef.current = false;
        if (event.pointerType === "mouse") {
          setPreview(true);
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        timerRef.current = window.setTimeout(() => {
          heldRef.current = true;
          setPreview(true);
        }, HOLD_MS);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse") return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        const held = heldRef.current;
        stopTouchHold();
        if (held || !canConvertRef.current) return;
        convertFromTouch(event);
      },
      onPointerCancel: stopTouchHold,
      onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse") setPreview(false);
        else stopTouchHold();
      },
      onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const held = heldRef.current;
        const tapped = tappedRef.current;
        heldRef.current = false;
        tappedRef.current = false;
        stopTouchHold();
        if (held || tapped || !canConvertRef.current) return;
        onTapRef.current();
      },
    },
  };
}
