import type { ReactNode } from "react";

/**
 * Shared content shell for standard Primary / Secondary app pages.
 * Immersive + Auth + Home Feed intentionally do not use this.
 */
export function AppPageShell({
  children,
  variant = "primary",
  className = "",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <section
      data-page-scroll
      aria-label={ariaLabel}
      className={[
        "app-page-shell",
        `app-page-shell--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="app-page-shell-inner">{children}</div>
    </section>
  );
}
