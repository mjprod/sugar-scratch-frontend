type BuyButtonProps = {
  label: string;
  onClick: () => void;
  visible?: boolean;
  disabled?: boolean;
};

/** Primary CTA (btn-180) used by Game Hub and pack reveal. */
export function BuyButton({
  label,
  onClick,
  visible = true,
  disabled = false,
}: BuyButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      className="btn-180 is-visible"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="btn-180-label">{label}</span>
    </button>
  );
}
