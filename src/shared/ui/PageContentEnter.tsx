import type { CSSProperties, ReactNode } from "react";
import "@/shared/ui/PageContentEnter.css";
import { usePageReady } from "@/shared/ui/usePageReady";

/**
 * Soft content entrance after a route push / skeleton lift.
 * Holds opacity 0 until page `revealed` (splash starts dismissing) so the
 * cascade isn't burned under SitePreloader. CSS-driven; respects reduced-motion.
 */
export function PageContentEnter({
  children,
  className = "",
  as: Tag = "div",
  stagger = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  /** Stagger direct children with nth-child delays. */
  stagger?: boolean;
  style?: CSSProperties;
}) {
  const { revealed } = usePageReady();

  return (
    <Tag
      className={[
        "page-content-enter",
        stagger ? "is-stagger" : "",
        revealed ? "is-entered" : "is-pending",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {children}
    </Tag>
  );
}
