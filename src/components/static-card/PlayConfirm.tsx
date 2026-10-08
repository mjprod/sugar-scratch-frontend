import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import "@/components/motion-card/MotionCard.css";
import "@/features/packs/packs.css";

export function PlayConfirm({
  anchor,
  playCost,
  onCancel,
  onConfirm,
}: {
  anchor: HTMLElement;
  playCost: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const height = ref.current?.offsetHeight ?? 84;
      setBox({
        top: rect.top - height - 8,
        left: rect.left + rect.width / 2,
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onCancel();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, onCancel]);

  return createPortal(
    <div
      ref={ref}
      className="coverflow-cart-remove-confirm static-card-buy-confirm is-anchored"
      role="dialog"
      aria-label={`Play for ${playCost} diamonds?`}
      aria-modal="false"
      style={{
        position: "fixed",
        top: box?.top ?? 0,
        left: box?.left ?? 0,
        zIndex: 5200,
        visibility: box ? "visible" : "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="coverflow-cart-remove-confirm__label static-card-buy-confirm__label">
        <span>PLAY?</span>
        <DiamondLottie size={12} aria-hidden />
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
    </div>,
    document.body,
  );
}
