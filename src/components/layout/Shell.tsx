import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function AppShell({
  children,
  label = "Sugar Scratch",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="min-h-full w-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="pointer-events-none sticky top-0 z-40 -mb-2 flex justify-end pt-2 sm:pt-3">
          <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white/40 backdrop-blur-md">
            {label} · v8
          </span>
        </div>
        <div
          className="relative flex min-h-[calc(100dvh-24px)] min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none lg:min-h-[calc(100dvh-40px)]"
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
}: {
  children: ReactNode;
  badge: string;
  /** Recommendation intro — compact card layout */
  intro?: boolean;
}) {
  const header = (
    <header className="auth7-onboard-header">
      <span className="auth2-logo">Sugar</span>
      <span className="auth7-onboard-badge">{badge}</span>
    </header>
  );
  const main = (
    <div className="auth7-onboard-main">
      <Stage>{children}</Stage>
    </div>
  );

  return (
    <div
      className={[
        "auth7-onboard-shell",
        intro ? "auth7-onboard-shell--intro" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-step={intro ? "recommend-intro" : undefined}
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
