import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared contextual header for secondary / subpages.
 * Primary tabs must not use this.
 */
export function SubpageHeader({
  title,
  onBack,
  backLabel = "Back",
  trailing,
}: {
  title?: string;
  onBack: () => void;
  /** Accessible name — prefer contextual “Back to …”. */
  backLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="subpage-header glass glass-strength-40 glass-blur-1 glass-saturation-150 glass-brightness-35 glass-surface">
      <button
        type="button"
        className="subpage-back"
        onClick={onBack}
        aria-label={backLabel}
      >
        <ChevronLeft className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>
      {title ? (
        <h1 className="subpage-title">{title}</h1>
      ) : (
        <span className="subpage-title-spacer" aria-hidden="true" />
      )}
      {trailing ? (
        <div className="subpage-trailing">{trailing}</div>
      ) : (
        <span className="subpage-trailing-spacer" aria-hidden="true" />
      )}
    </header>
  );
}
