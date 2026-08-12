import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function AppShell({
  children,
}: {
  children: ReactNode;
  /** @deprecated Dev-only label removed from production chrome. */
  label?: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Full-bleed app shell — page content owns horizontal padding / max-width. */}
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
          aria-label="Sugar Scratch"
        >
          <Stage>{children}</Stage>
        </div>
      </div>
    </div>
  );
}

export function OnboardShell({
  children,
  badge,
  intro = false,
  swipe = false,
}: {
  children: ReactNode;
  badge: string;
  /** Recommendation intro — compact card layout */
  intro?: boolean;
  /** Full-bleed incoming swipe stage */
  swipe?: boolean;
}) {
  const header = (
    <header className="auth7-onboard-header">
      <span className="auth2-logo">Sugar</span>
      <span className="auth7-onboard-badge">{badge}</span>
    </header>
  );
  const main = (
    <div className="auth7-onboard-main">
      {swipe ? children : <Stage>{children}</Stage>}
    </div>
  );

  return (
    <div
      className={[
        "auth7-onboard-shell",
        intro ? "auth7-onboard-shell--intro" : "",
        swipe ? "auth7-onboard-shell--swipe" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-step={
        intro ? "recommend-intro" : swipe ? "personalize-swipe" : undefined
      }
      aria-label="Personalization"
    >
      {intro ? (
        <div className="auth7-intro-card">
          {header}
          {main}
        </div>
      ) : (
        <>
          {header}
          {main}
        </>
      )}
    </div>
  );
}

function Stage({ children }: { children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
