import { useRef } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { isMemoryTransitioning } from "@/lib/memory/memoryNavigate";
import {
  historyIndex,
  pushDirection,
  shouldSkipPushHop,
} from "@/lib/pagePushTransition";

const PUSH_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

const pushVariants = {
  enter: (direction: 1 | -1) => ({
    x: direction > 0 ? "100%" : "-100%",
    zIndex: 2,
  }),
  center: {
    x: 0,
    zIndex: 2,
  },
  exit: (direction: 1 | -1) => ({
    x: direction > 0 ? "-100%" : "100%",
    zIndex: 1,
  }),
};

/**
 * iOS-style push between AppLayout pages. Chrome stays put; only this stage
 * slides. Scratch / purchase hops, and any hop the memory veil owns, render
 * the outlet with no transform ancestor.
 */
export function PagePushStage() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const trail = useRef<{
    pathname: string;
    idx: number;
    direction: 1 | -1;
  }>({
    pathname: location.pathname,
    idx: historyIndex(),
    direction: 1,
  });

  const idx = historyIndex();
  if (location.pathname !== trail.current.pathname) {
    trail.current = {
      pathname: location.pathname,
      idx,
      direction: pushDirection(trail.current.idx, idx),
    };
  } else {
    trail.current.idx = idx;
  }

  const skip =
    Boolean(reduceMotion) ||
    shouldSkipPushHop(trail.current.pathname, location.pathname) ||
    isMemoryTransitioning();

  if (skip) {
    return outlet;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={trail.current.direction}>
      <m.div
        key={location.pathname}
        className="absolute inset-0 flex h-full min-h-0 flex-col overflow-hidden"
        custom={trail.current.direction}
        variants={pushVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.34, ease: PUSH_EASE }}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  );
}
