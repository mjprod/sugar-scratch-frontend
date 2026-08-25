import { forwardRef } from "react";

/**
 * Global HUD utility control — cart for packs to open (TopNav / mobile utility).
 * Unread inbox count uses {@link InboxUtilityBadge} on the Profile icon.
 */
export function InboxUtilityBadge({ count = 0 }: { count?: number }) {
  if (count <= 0) return null;
  const badgeLabel = count > 9 ? "9+" : String(count);
  return (
    <span className="inbox-utility-badge" aria-hidden="true">
      {badgeLabel}
    </span>
  );
}

function CartOutlineIcon({
  className,
  strokeWidth = 32,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="176"
        cy="416"
        r="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <circle
        cx="400"
        cy="416"
        r="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M48 80h64l48 272h256"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M160 288h249.44a8 8 0 0 0 7.85-6.43l28.8-144a8 8 0 0 0-7.85-9.57H128"
      />
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
  }
>(function PacksButton(
  { onOpen, className = "", variant = "surface", active = false },
  ref,
) {
  const surfaceClasses =
    "inbox-utility-btn relative grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95";
  const ghostClasses =
    "inbox-utility-btn inbox-utility-btn--ghost relative grid min-h-10 min-w-10 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/85 active:scale-95";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label="Pack Pocket"
      aria-current={active ? "page" : undefined}
      className={[
        variant === "ghost" ? ghostClasses : surfaceClasses,
        active ? "is-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CartOutlineIcon
        className={variant === "ghost" ? "size-[18px]" : "size-5"}
      />
    </button>
  );
});
