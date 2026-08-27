import { useEffect, useRef, useState } from "react";
import { countCartPacks, subscribeCart } from "@/services/cart";

const TOAST_MS = 2000;
const MAX_VISIBLE = 3;
const EXIT_MS = 320;

type ToastItem = {
  id: number;
  leaving: boolean;
};

export function PackAddedToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);
  const hideTimersRef = useRef(new Map<number, number>());
  const leaveTimersRef = useRef(new Map<number, number>());

  useEffect(() => {
    function clearTimer(id: number, store: Map<number, number>) {
      const timer = store.get(id);
      if (timer != null) window.clearTimeout(timer);
      store.delete(id);
    }

    function removeToast(id: number) {
      clearTimer(id, hideTimersRef.current);
      clearTimer(id, leaveTimersRef.current);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }

    function startLeave(id: number) {
      if (leaveTimersRef.current.has(id)) return;
      clearTimer(id, hideTimersRef.current);
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id ? { ...toast, leaving: true } : toast,
        ),
      );
      leaveTimersRef.current.set(
        id,
        window.setTimeout(() => removeToast(id), EXIT_MS),
      );
    }

    function pushToast() {
      const id = nextIdRef.current++;
      setToasts((current) => {
        const overflow = current.filter((toast) => !toast.leaving).slice(MAX_VISIBLE - 1);
        overflow.forEach((toast) => startLeave(toast.id));
        return [{ id, leaving: false }, ...current];
      });
      hideTimersRef.current.set(
        id,
        window.setTimeout(() => startLeave(id), TOAST_MS),
      );
    }

    let previousCount = countCartPacks();
    const unsubscribe = subscribeCart(() => {
      const count = countCartPacks();
      const added = Math.max(0, count - previousCount);
      previousCount = count;
      for (let i = 0; i < added; i += 1) pushToast();
    });

    const hideTimers = hideTimersRef.current;
    const leaveTimers = leaveTimersRef.current;
    return () => {
      unsubscribe();
      hideTimers.forEach((timer) => window.clearTimeout(timer));
      leaveTimers.forEach((timer) => window.clearTimeout(timer));
      hideTimers.clear();
      leaveTimers.clear();
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="pack-added-toast-stack" aria-live="polite">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={[
            "pack-added-toast",
            toast.leaving ? "is-leaving" : "is-visible",
          ].join(" ")}
          style={{
            ["--pack-added-toast-offset" as string]: `${index * 2}px`,
            zIndex: toasts.length - index,
          }}
          role="status"
        >
          <span className="pack-added-toast__strip" aria-hidden="true" />
          <p className="pack-added-toast__copy">Pack added to Pocket</p>
        </div>
      ))}
    </div>
  );
}
