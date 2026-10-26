import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared empty-state pattern: art/icon → title → copy → optional CTA.
 * Empty ≠ Error.
 */
export function EmptyState({
  icon: Icon,
  art,
  title,
  copy,
  action,
  titleId,
}: {
  icon?: LucideIcon;
  art?: ReactNode;
  title: string;
  copy: string;
  action?: ReactNode;
  titleId?: string;
}) {
  return (
    <section className="app-empty" aria-labelledby={titleId}>
      {art ? (
        <span className="app-empty-art" aria-hidden="true">
          {art}
        </span>
      ) : Icon ? (
        <span className="app-empty-icon" aria-hidden="true">
          <Icon className="size-10" strokeWidth={1.4} />
        </span>
      ) : null}
      <h2 id={titleId} className="app-empty-title">
        {title}
      </h2>
      <p className="app-empty-copy">{copy}</p>
      {action ? <div className="app-empty-action">{action}</div> : null}
    </section>
  );
}
