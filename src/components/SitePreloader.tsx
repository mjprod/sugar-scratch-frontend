import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { PreLoaderVisual } from "@/components/PreLoaderVisual";
import {
  isPageWarmed,
  routeNeedsWait,
  usePageReady,
} from "@/shared/ui/PageTransition";
import "./SitePreloader.css";

const MIN_MS = 1800;
const MAX_MS = 4500;
const FADE_MS = 420;

function shouldCover(pathname: string, search: string) {
  return routeNeedsWait(pathname) && !isPageWarmed(pathname, search);
}

/**
 * Official branded splash. Covers the live route until its first useful view
 * is ready, clamped to a brand floor and a hard ceiling.
 */
export function SitePreloader() {
  const location = useLocation();
  const { ready } = usePageReady();
  const key = `${location.pathname}${location.search}`;
  const [overlay, setOverlay] = useState(() => ({
    key,
    visible: shouldCover(location.pathname, location.search),
    hiding: false,
  }));
  const shownAtRef = useRef(overlay.visible ? performance.now() : 0);
  const fadeTimerRef = useRef(0);

  if (overlay.key !== key) {
    const visible = shouldCover(location.pathname, location.search);
    setOverlay({ key, visible, hiding: false });
    if (visible) shownAtRef.current = performance.now();
  }

  useEffect(() => {
    if (!overlay.visible || overlay.hiding || !ready) return;

    const elapsed = performance.now() - shownAtRef.current;
    if (elapsed < 16) {
      setOverlay((current) =>
        current.visible ? { ...current, visible: false, hiding: false } : current,
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setOverlay((current) =>
        current.visible ? { ...current, hiding: true } : current,
      );
      fadeTimerRef.current = window.setTimeout(() => {
        setOverlay((current) =>
          current.visible ? { ...current, visible: false, hiding: false } : current,
        );
      }, FADE_MS);
    }, Math.max(0, MIN_MS - elapsed));
    return () => window.clearTimeout(timer);
  }, [overlay.hiding, overlay.visible, ready]);

  useEffect(() => {
    if (!overlay.visible || overlay.hiding || ready) return;
    const elapsed = performance.now() - shownAtRef.current;
    const timer = window.setTimeout(() => {
      setOverlay((current) =>
        current.visible ? { ...current, hiding: true } : current,
      );
      fadeTimerRef.current = window.setTimeout(() => {
        setOverlay((current) =>
          current.visible ? { ...current, visible: false, hiding: false } : current,
        );
      }, FADE_MS);
    }, Math.max(0, MAX_MS - elapsed));
    return () => window.clearTimeout(timer);
  }, [overlay.hiding, overlay.visible, ready]);

  useEffect(
    () => () => {
      window.clearTimeout(fadeTimerRef.current);
    },
    [key],
  );

  if (!overlay.visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={["site-preloader", overlay.hiding ? "is-hiding" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-busy={!overlay.hiding}
      aria-label="Loading Sugar Scratch"
    >
      <PreLoaderVisual />
    </div>,
    document.body,
  );
}
