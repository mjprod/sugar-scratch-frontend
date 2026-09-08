/**
 * Shared Buy Pack confirm dialog for desktop coverflow + mobile CSS carousel.
 * Portaled to document.body so it can stack above Daily Reward without
 * elevating the whole hero host (which washed out the banner background).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Plus, X } from "lucide-react";
import {
  BUY_PACK_MAX_QUANTITY,
  clampBuyPackQuantity,
} from "@/services/purchase";

export type CoverflowBuyConfirmProps = {
  id: string;
  leaving?: boolean;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onCancel: () => void;
  onConfirm: (quantity: number) => void;
  onLeaveEnd?: () => void;
  disabled?: boolean;
  /** Show qty stepper (desktop default). Mobile can hide if desired. */
  showQuantity?: boolean;
  label?: string;
  className?: string;
  /** Outline row under X/Check — Add to Pocket. */
  onAddToPocket?: () => void;
  pocketDisabled?: boolean;
  pocketLabel?: string;
  pocketAriaLabel?: string;
  /**
   * Anchor element for fixed positioning (usually the Buy Pack CTA primary).
   * When omitted, falls back to the nearest `.coverflow-buy-pack-cta__primary`.
   */
  anchorRef?: { current: HTMLElement | null };
};

const LEAVE_ANIMATIONS = new Set([
  "coverflow-confirm-leave",
  "coverflow-buy-confirm-leave",
]);

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FixedBox = {
  top: number;
  left: number;
  width: number;
};

function PackPocketIcon({ className }: { className?: string }) {
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
        <path d="M4.8 3h14.4c.477 0 .935.199 1.273.553S21 4.388 21 4.89v6.667c0 2.504-.948 4.907-2.636 6.678S14.387 21 12 21a8.6 8.6 0 0 1-3.444-.719a9 9 0 0 1-2.92-2.047C3.948 16.463 3 14.06 3 11.556V4.889c0-.501.19-.982.527-1.336A1.76 1.76 0 0 1 4.8 3" />
        <path d="M12 7.75v6.5" />
        <path d="M8.75 11h6.5" />
      </g>
    </svg>
  );
}

function resolveAnchor(
  anchorRef: CoverflowBuyConfirmProps["anchorRef"],
  fallback: HTMLElement | null,
) {
  return anchorRef?.current ?? fallback;
}

function dialogFocusables(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) =>
      el.getAttribute("aria-disabled") !== "true" &&
      // Fixed-position dialogs often have offsetParent === null — use client rects.
      el.getClientRects().length > 0,
  );
}

export function CoverflowBuyConfirm({
  id,
  leaving = false,
  quantity,
  onQuantityChange,
  onCancel,
  onConfirm,
  onLeaveEnd,
  disabled = false,
  showQuantity = true,
  label = "Buy",
  className,
  onAddToPocket,
  pocketDisabled = false,
  pocketLabel = "Add to Pocket",
  pocketAriaLabel,
  anchorRef,
}: CoverflowBuyConfirmProps) {
  const qty = clampBuyPackQuantity(quantity);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [box, setBox] = useState<FixedBox | null>(null);

  useLayoutEffect(() => {
    let raf = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const fallbackPrimary = probeRef.current?.closest(
        ".coverflow-buy-pack-cta__primary",
      ) as HTMLElement | null;
      const anchor =
        resolveAnchor(anchorRef, fallbackPrimary) ??
        (probeRef.current?.closest(
          ".coverflow-buy-pack-cta",
        ) as HTMLElement | null);
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const next: FixedBox = {
        top: rect.bottom + 7, // ~0.45rem
        left: rect.left + rect.width / 2,
        width: Math.max(rect.width, 13.3 * 16),
      };
      setBox((prev) => {
        if (
          prev &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5
        ) {
          return prev;
        }
        return next;
      });
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
    };
  }, [anchorRef, leaving, quantity]);

  // Keyboard: move focus into the portaled dialog, trap Tab, Escape cancels.
  useEffect(() => {
    if (leaving) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Wait until the dialog is measured (pointer-events restored) so focus sticks.
    let tries = 0;
    let raf = 0;
    const focusWhenReady = () => {
      const focusables = dialogFocusables(dialog);
      if (focusables.length > 0) {
        focusables[0]?.focus();
        return;
      }
      if (tries++ < 20) {
        raf = window.requestAnimationFrame(focusWhenReady);
      }
    };
    raf = window.requestAnimationFrame(focusWhenReady);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogFocusables(dialog);
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      if (!(active instanceof Node) || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown, true);
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === "function" &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [leaving, onCancel]);

  function handleLeaveEnd(event: ReactAnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!LEAVE_ANIMATIONS.has(event.animationName)) return;
    onLeaveEnd?.();
  }

  const style: CSSProperties | undefined = box
    ? {
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        minWidth: box.width,
        transform: "translateX(-50%)",
        zIndex: 5200,
      }
    : {
        // First paint before measure — keep offscreen but mounted for animation.
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 5200,
      };

  const dialog = (
    <div
      ref={dialogRef}
      id={id}
      className={[
        "coverflow-cart-remove-confirm",
        "coverflow-buy-confirm",
        "is-portaled",
        leaving ? "is-leaving" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="dialog"
      aria-label="Buy pack?"
      aria-modal="true"
      style={style}
      onAnimationEnd={handleLeaveEnd}
    >
      <p className="coverflow-cart-remove-confirm__label">{label}</p>
      {showQuantity ? (
        <div
          className="coverflow-buy-confirm__qty"
          role="group"
          aria-label="Pack quantity"
        >
          <button
            type="button"
            className="coverflow-buy-confirm__qty-btn"
            aria-label="Decrease pack quantity"
            disabled={disabled || qty <= 1}
            onClick={(event) => {
              event.stopPropagation();
              onQuantityChange(clampBuyPackQuantity(qty - 1));
            }}
          >
            <Minus aria-hidden="true" strokeWidth={2.5} />
          </button>
          <span className="coverflow-buy-confirm__qty-value" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className="coverflow-buy-confirm__qty-btn"
            aria-label="Increase pack quantity"
            disabled={disabled || qty >= BUY_PACK_MAX_QUANTITY}
            onClick={(event) => {
              event.stopPropagation();
              onQuantityChange(clampBuyPackQuantity(qty + 1));
            }}
          >
            <Plus aria-hidden="true" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}
      <div className="coverflow-cart-remove-confirm__actions">
        <button
          type="button"
          className="coverflow-cart-remove-confirm__btn is-cancel"
          aria-label="Cancel buy"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          <X aria-hidden="true" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="coverflow-cart-remove-confirm__btn is-confirm"
          aria-label={showQuantity ? `Confirm buy ${qty}` : "Confirm buy"}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            if (disabled) return;
            onConfirm(qty);
          }}
        >
          <Check aria-hidden="true" strokeWidth={2.5} />
        </button>
      </div>
      {onAddToPocket ? (
        <>
          <div className="coverflow-buy-confirm__or" role="separator" aria-label="or">
            <span className="coverflow-buy-confirm__or-line" aria-hidden="true" />
            <span className="coverflow-buy-confirm__or-text">or</span>
            <span className="coverflow-buy-confirm__or-line" aria-hidden="true" />
          </div>
          <div className="coverflow-buy-confirm__pocket-row">
            <button
              type="button"
              className="coverflow-buy-confirm__pocket"
              disabled={pocketDisabled}
              aria-disabled={pocketDisabled || undefined}
              aria-label={
                pocketAriaLabel ||
                (pocketDisabled ? "Already in Pack Pocket" : "Add to Pocket")
              }
              onClick={(event) => {
                event.stopPropagation();
                if (pocketDisabled) return;
                onAddToPocket();
              }}
            >
              <PackPocketIcon className="coverflow-buy-confirm__pocket-icon" />
              <span className="coverflow-buy-confirm__pocket-label">
                {pocketLabel}
              </span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  // Probe stays in the CTA tree so we can resolve the anchor on first paint.
  return (
    <>
      <span
        ref={probeRef}
        className="coverflow-buy-confirm-anchor-probe"
        aria-hidden="true"
      />
      {typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : null}
    </>
  );
}
