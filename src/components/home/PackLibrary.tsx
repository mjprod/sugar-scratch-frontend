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

const SLIDE = { type: "tween" as const, duration: 0.4, ease: [0.32, 0.72, 0, 1] };

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
  const reduce = useReducedMotion();

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

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const scroller = document.querySelector<HTMLElement>("[data-page-scroll]");
    const previousOverflow = scroller?.style.overflow ?? "";
    const previousBodyOverflow = document.body.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroller) scroller.style.overflow = previousOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  const filtered = packs.filter((p) => {
    const hay = `${p.name} ${p.creatorName} ${p.themeName}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pack-library"
          className="pack-library-overlay fixed inset-0 z-[1100] flex h-[100dvh] items-start justify-center overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Pack library"
          initial={reduce ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduce ? undefined : { y: "100%" }}
          transition={SLIDE}
        >
          <div className="pack-library-panel mx-auto mt-[8dvh] flex h-[calc(100dvh-8dvh)] max-h-[84dvh] w-full flex-col lg:h-auto lg:max-w-[60rem]">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-[24px] font-bold tracking-[-0.02em]">All Packs</h2>
              <button
                type="button"
                onClick={onClose}
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
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
