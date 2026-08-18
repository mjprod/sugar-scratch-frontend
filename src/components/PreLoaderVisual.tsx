import { useEffect, useRef } from "react";
import { CardFallLoader } from "@/components/CardFallLoader";
import { LoadingLabel } from "@/components/LoadingLabel";

/** Branded CardFall splash — same treatment as `/pre-loader`. */
export function PreLoaderVisual() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      el.style.setProperty("--mx", String(nx));
      el.style.setProperty("--my", String(ny));
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="fixed inset-0 flex w-screen flex-col items-center justify-center overflow-hidden px-6 text-center [--mx:0] [--my:0]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, oklch(0.639 0.256 9.90 / 0.28), transparent 45%), linear-gradient(180deg, oklch(0.196 0 0), oklch(0.14 0 0))",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center">
        <CardFallLoader label="Loading Sugar Scratch" />
        <LoadingLabel />
      </div>
    </section>
  );
}
