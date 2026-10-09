import { lazy, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { searchPackToPurchase } from "@/services/search";
import { useAuth } from "@/contexts/useAuth";

const SearchScreen = lazy(() =>
  import("@/components/search/SearchScreen").then((mod) => ({
    default: mod.SearchScreen,
  })),
);

const ROOT_VARIANTS = {
  hidden: {
    transition: {
      when: "afterChildren" as const,
      staggerChildren: 0.04,
      staggerDirection: -1 as const,
    },
  },
  visible: {
    transition: {
      when: "beforeChildren" as const,
      staggerChildren: 0.05,
    },
  },
};

const BACKDROP_VARIANTS = {
  hidden: {
    opacity: 0,
    transition: { duration: 0.22, ease: "easeOut" as const },
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.28, ease: "easeOut" as const },
  },
};

const PANEL_VARIANTS = {
  hidden: {
    y: "100%",
    transition: {
      type: "tween" as const,
      duration: 0.36,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
    },
  },
  visible: {
    y: 0,
    transition: {
      type: "tween" as const,
      duration: 0.42,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
    },
  },
};

export function PackLibrary({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { authOpen, openCreator, openPurchase } = useAuth();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (authOpen) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authOpen, open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const locked: Array<{ el: HTMLElement; overflow: string }> = [];
    document.querySelectorAll<HTMLElement>("[data-page-scroll]").forEach((el) => {
      if (el.closest(".pack-library-root")) return;
      locked.push({ el, overflow: el.style.overflow });
      el.style.overflow = "hidden";
    });
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      for (const item of locked) item.el.style.overflow = item.overflow;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <m.div
          key="pack-library"
          className="pack-library-root fixed inset-0 z-[5150] flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden"
          role="presentation"
          initial={reduce ? false : "hidden"}
          animate="visible"
          exit={reduce ? undefined : "hidden"}
          variants={ROOT_VARIANTS}
        >
          {/* Backdrop fades on its own track — not tied to the sheet transform. */}
          <m.button
            type="button"
            className="pack-library-overlay absolute inset-0"
            aria-label="Dismiss search"
            variants={BACKDROP_VARIANTS}
            onClick={onClose}
          />
          {/* Search sheet slides up independently of the overlay fade. */}
          <m.div
            className="pack-library-panel relative z-[1] mx-auto mt-auto flex min-h-0 w-full max-w-[75rem] flex-1 flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            variants={PANEL_VARIANTS}
          >
            <Suspense
              fallback={
                <div className="grid flex-1 place-items-center">
                  <Loader2
                    className="size-8 animate-spin text-white/70"
                    role="status"
                    aria-label="Loading search"
                  />
                </div>
              }
            >
              <SearchScreen
                onCancel={onClose}
                onOpenCreator={openCreator}
                onOpenPack={(pack) => {
                  openPurchase(searchPackToPurchase(pack), "buy-pack");
                }}
              />
            </Suspense>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
