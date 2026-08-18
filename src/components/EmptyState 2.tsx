import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared empty-state pattern: icon → title → copy → optional CTA.
 * Empty ≠ Error.
 */
export function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
  titleId,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: ReactNode;
  titleId?: string;
}) {
  return (
    <section className="app-empty" aria-labelledby={titleId}>
      <span className="app-empty-icon" aria-hidden="true">
        <Icon className="size-10" strokeWidth={1.4} />
      </span>
      <h2 id={titleId} className="app-empty-title">
        {title}
      </h2>
      <p className="app-empty-copy">{copy}</p>
      {action ? <div className="app-empty-action">{action}</div> : null}
    </section>
  );
}
