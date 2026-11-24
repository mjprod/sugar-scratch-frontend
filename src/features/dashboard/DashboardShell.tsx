import { Theme } from "@radix-ui/themes";
import type { ReactNode } from "react";
import "@radix-ui/themes/styles.css";
import "./dashboard.css";

/**
 * Same Radix theme as the operator app (red accent, sand gray, medium radius).
 *
 * ponytail: `@radix-ui/themes/styles.css` defines its palette on `:root`.
 * Player screens do not read those token names. If one ever collides, scope
 * the stylesheet to `.dashboard-theme` and portal dialogs into this shell.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <Theme
      accentColor="red"
      className="dashboard-theme"
      grayColor="sand"
      radius="medium"
    >
      {children}
    </Theme>
  );
}
