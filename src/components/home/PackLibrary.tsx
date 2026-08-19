import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import {
  fetchPackLibrary,
  formatPrice,
  type FeaturedPack,
} from "@/services/homepage";
import { PackArt } from "./PackArt";

const ENTER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EXIT_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

export function PackLibrary({
  open,
  onClose,
  onPlay,
}: {
  open: boolean;
  onClose: () => void;
  onPlay: (pack: FeaturedPack) => void;
}) {
  const [packs, setPacks] = useState<FeaturedPack[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchPackLibrary().then((data) => {
      if (!alive) return;
      setPacks(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const reduce = useReducedMotion();

  function finishClose() {
    setVisible(false);
    setClosing(false);
    onClose();
  }

  function requestClose() {
    if (!visible || closing) return;
    if (reduce) {
      finishClose();
      return;
    }
    setClosing(true);
  }

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (visible && !closing) requestClose();
  }, [open, reduce]);

  useEffect(() => {
    if (!visible || closing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, closing]);

  useEffect(() => {
    if (!visible) return;
    const scroller = document.querySelector<HTMLElement>("[data-page-scroll]");
    const previousOverflow = scroller?.style.overflow ?? "";
    const previousBodyOverflow = document.body.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroller) scroller.style.overflow = previousOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [visible]);

  const filtered = packs.filter((p) => {
    const hay = `${p.name} ${p.creatorName} ${p.themeName}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] items-start justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Pack library"
    >
      <motion.div
        className="pack-library-glass mx-auto mt-[8dvh] flex h-[calc(100dvh-8dvh)] max-h-[84dvh] w-full flex-col lg:h-auto lg:max-w-[60rem]"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 72 }}
        animate={
          reduce
            ? { opacity: closing ? 0 : 1 }
            : { opacity: closing ? 0 : 1, y: closing ? 72 : 0 }
        }
        transition={
          reduce
            ? { duration: 0.16 }
            : closing
              ? { duration: 0.32, ease: EXIT_EASE }
              : {
                  y: { type: "spring", stiffness: 420, damping: 34, mass: 0.86 },
                  opacity: { duration: 0.24, ease: ENTER_EASE },
                }
        }
        onAnimationComplete={() => {
          if (closing) finishClose();
        }}
      >
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="text-[24px] font-bold tracking-[-0.02em]">All Packs</h2>
        <button
          type="button"
          onClick={requestClose}
          className="grid size-11 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.606_0.219_292.72)]"
          aria-label="Close pack library"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="px-5 pb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search packs, creators, themes"
          aria-label="Search packs"
          className="h-12 w-full rounded-full border border-white/10 bg-white/[0.06] px-4 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[oklch(0.606_0.219_292.72)]/50"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] rounded-[24px] bg-white/10" />
                <div className="mt-2 h-3 w-3/4 rounded bg-white/10" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">No packs match</p>
            <p className="mt-1 text-[13px] text-white/45">
              Try another creator, theme, or clear search.
            </p>
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="mt-4 min-h-11 rounded-full bg-[oklch(0.606_0.219_292.72)] px-5 text-[13px] font-semibold"
              >
                Clear search
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPlay(p)}
                className="rounded-2xl text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.606_0.219_292.72)]"
              >
                <PackArt src={p.coverImageUrl} alt={p.name} size="thumb" className="!w-full" />
                <p className="mt-2 truncate px-0.5 text-[13px] font-semibold">{p.name}</p>
                <p className="truncate px-0.5 text-[12px] text-white/45">
                  {p.creatorName} · {formatPrice(p.price)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
      </motion.div>
    </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
