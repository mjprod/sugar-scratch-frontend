import type { ReactNode } from "react";

/**
 * Shared responsive content width for standard Sugar pages.
 * Full-bleed chrome (HUD / BottomNav / backgrounds) stays outside this.
 */
export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["page-container", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
