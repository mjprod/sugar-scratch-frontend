import { useCallback, useEffect } from "react";
import { useMotionOptional } from "@/features/collection/hooks/useMotion";
import { mcpCtaGradAngleFromMotion } from "@/components/creator/mcpCtaGradMotion";

const WRAP_SEL = ".mcp-photo-play-cta-css-wrap";
/** Soft follow — lower = laggy. Shared by every CSS CTA wrap. */
const LERP = 0.05;

function clearMotionGrad(node: HTMLElement) {
  node.classList.remove("is-motion-grad");
  node.style.removeProperty("--mcp-cta-grad-angle");
}

/**
 * Drives `--mcp-cta-grad-angle` on every `.mcp-photo-play-cta-css-wrap` while
 * Profile tilt is on. Mount once under MotionProvider.
 */
export function McpCtaGradMotionRoot() {
  const motion = useMotionOptional();
  const tiltOn = Boolean(motion?.enabled && motion.permission === "granted");

  useEffect(() => {
    const clearAll = () => {
      document.querySelectorAll<HTMLElement>(WRAP_SEL).forEach(clearMotionGrad);
    };

    if (
      !motion ||
      !tiltOn ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      clearAll();
      return;
    }

    const angles = new WeakMap<HTMLElement, number>();
    return motion.subscribe((sample) => {
      if (!sample.hasSample) return;
      const target = mcpCtaGradAngleFromMotion(sample.gamma, sample.beta);
      document.querySelectorAll<HTMLElement>(WRAP_SEL).forEach((node) => {
        if (node.classList.contains("is-disabled")) {
          clearMotionGrad(node);
          return;
        }
        node.classList.add("is-motion-grad");
        let angle = angles.get(node) ?? 45;
        angle += (target - angle) * LERP;
        angles.set(node, angle);
        node.style.setProperty("--mcp-cta-grad-angle", `${angle.toFixed(1)}deg`);
      });
    });
  }, [motion, tiltOn]);

  return null;
}

/**
 * Optional local ref for CSS CTA wraps. Tilt is applied globally by
 * McpCtaGradMotionRoot — this stays so remount-friendly refs keep compiling.
 */
export function useMcpCtaGradMotion(_enabled = true) {
  return useCallback((_el: HTMLDivElement | null) => {}, []);
}
