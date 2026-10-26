import { useCallback, useEffect, useRef, type PointerEvent, type MouseEvent } from "react";
import { createHoldRepeat } from "@/hooks/holdRepeat";

/** Bind a button so a tap steps once and a hold keeps stepping. */
export function useHoldRepeat(action: () => void) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const holdRef = useRef<ReturnType<typeof createHoldRepeat> | null>(null);
  if (!holdRef.current) {
    holdRef.current = createHoldRepeat(() => actionRef.current());
  }

  useEffect(() => () => holdRef.current?.stop(), []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      const btn = event.currentTarget;
      if (btn.disabled) return;
      btn.setPointerCapture(event.pointerId);
      holdRef.current?.start(() => btn.disabled);
    },
    [],
  );

  const onPointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    holdRef.current?.stop();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    // Pointer already fired on pointerdown. Keyboard (detail 0) still clicks.
    if (event.detail !== 0) {
      event.preventDefault();
      return;
    }
    actionRef.current();
  }, []);

  const onContextMenu = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onClick,
    onContextMenu,
  };
}
