import { useEffect } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

export function HdVideoWarning({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onDismiss]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/70 px-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hd-video-warning-title"
        className="w-full max-w-sm rounded-[28px] border border-white/[0.1] bg-[oklch(0.191_0.01_303.57)] p-6 text-center shadow-[0_24px_60px_oklch(0_0_0_/_0.55)]"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[oklch(0.767_0.139_91.06)]/15 text-[oklch(0.84_0.14_85)]">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h2 id="hd-video-warning-title" className="sr-only">
          HD video warning
        </h2>
	        <p className="mt-4 text-body leading-relaxed text-white/70">
	          <span className="block text-title text-white/85">
	            Higher-Resolution videos on newer phones.
	          </span>
	          Uses more data & more CPU processing.
	        </p>
        <div className="mt-6 h-12 w-full">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Dismiss"
            costAmount={null}
            onClick={onDismiss}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
