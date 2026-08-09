import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  fetchPackLibrary,
  formatPrice,
  type FeaturedPack,
} from "../../flow/homepage";
import { PackArt } from "./PackArt";

export function PackLibrary({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: (pack: FeaturedPack) => void;
}) {
  const [packs, setPacks] = useState<FeaturedPack[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

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
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = packs.filter((p) => {
    const hay = `${p.name} ${p.creatorName} ${p.themeName}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-[#090909]/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Pack library"
    >
      <div className="flex items-center justify-between px-5 pt-[max(72px,env(safe-area-inset-top)+56px)] pb-3">
        <h2 className="text-[24px] font-bold tracking-[-0.02em]">All Packs</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
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
          className="h-12 w-full rounded-full border border-white/10 bg-white/[0.06] px-4 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[#8B5CF6]/50"
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
                className="mt-4 min-h-11 rounded-full bg-[#8B5CF6] px-5 text-[13px] font-semibold"
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
                className="rounded-2xl text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
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
  );
}
