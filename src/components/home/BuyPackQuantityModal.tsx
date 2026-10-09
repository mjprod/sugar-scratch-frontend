import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";

import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import {
  BUY_PACK_MAX_QUANTITY,
  clampBuyPackQuantity,
} from "@/services/purchase";

const PANEL_GLASS =
  "glass glass-strength-80 glass-blur-2 glass-saturation-140 glass-brightness-30 glass-surface";

export function BuyPackQuantityModal({
  packTitle,
  unitPrice,
  quantity,
  buyDisabled = false,
  showAddToPocket = true,
  formatPrice,
  onQuantityChange,
  onClose,
  onBuy,
  onAddToPocket,
}: {
  packTitle: string;
  unitPrice: number;
  quantity: number;
  buyDisabled?: boolean;
  showAddToPocket?: boolean;
  formatPrice: (price: number) => string;
  onQuantityChange: (next: number) => void;
  onClose: () => void;
  onBuy: () => void;
  onAddToPocket?: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const qty = clampBuyPackQuantity(quantity);
  const total = unitPrice * qty;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="buy-pack-qty-modal" role="presentation">
      <button
        type="button"
        className="buy-pack-qty-modal__scrim"
        aria-label="Close buy pack"
        onClick={onClose}
      />
      <div
        className={`buy-pack-qty-modal__panel ${PANEL_GLASS}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeRef}
          type="button"
          className="buy-pack-qty-modal__close"
          aria-label="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} strokeWidth={2.25} />
        </button>
        <h2 id={titleId} className="buy-pack-qty-modal__title">
          {packTitle}
        </h2>
        <p className="buy-pack-qty-modal__subtitle">How many packs?</p>
        <div
          className="buy-pack-qty-modal__qty"
          role="group"
          aria-label="Pack quantity"
        >
          <button
            type="button"
            className="buy-pack-qty-modal__qty-btn"
            aria-label="Decrease pack quantity"
            disabled={buyDisabled || qty <= 1}
            onClick={() => onQuantityChange(clampBuyPackQuantity(qty - 1))}
          >
            <Minus aria-hidden="true" strokeWidth={2.5} size={18} />
          </button>
          <span className="buy-pack-qty-modal__qty-value" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className="buy-pack-qty-modal__qty-btn"
            aria-label="Increase pack quantity"
            disabled={buyDisabled || qty >= BUY_PACK_MAX_QUANTITY}
            onClick={() => onQuantityChange(clampBuyPackQuantity(qty + 1))}
          >
            <Plus aria-hidden="true" strokeWidth={2.5} size={18} />
          </button>
        </div>
        <div className="buy-pack-qty-modal__buy">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            type="button"
            label="Buy Pack"
            costAmount={formatPrice(total)}
            costIconAnimated={false}
            fontSize={15}
            glowOuterBloom="off"
            disabled={buyDisabled}
            onClick={onBuy}
          />
        </div>
        {showAddToPocket && onAddToPocket ? (
          <button
            type="button"
            className="buy-pack-qty-modal__pocket"
            onClick={onAddToPocket}
          >
            + Add to Pocket
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
