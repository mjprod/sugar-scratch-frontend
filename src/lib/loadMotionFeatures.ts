/**
 * Async LazyMotion feature bundle. Every separate React root that renders `m`
 * components (e.g. drei `<Html>` overlays) needs its own `<LazyMotion>` with
 * this loader — `m` reads its renderer from LazyMotion context, which does not
 * cross React roots.
 */
export const loadMotionFeatures = () =>
  import("@/lib/motionFeatures").then((mod) => mod.default);
