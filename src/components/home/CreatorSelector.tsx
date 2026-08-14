import type { CreatorSummary } from "@/services/homeFeed";
import { CreatorAvatar } from "./PackArt";

export function CreatorSelector({
  creators,
  selectedId,
  onSelect,
  highlightFirst,
}: {
  creators: CreatorSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  highlightFirst?: boolean;
}) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold tracking-wide text-white/45 uppercase">
        Creators
      </h2>
      <div
        className="mt-3 flex gap-3 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Creator selector"
      >
        {creators.map((c, i) => {
          const selected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={!c.isAvailable}
              onClick={() => {
                if (c.id === selectedId) return;
                onSelect(c.id);
              }}
              className={[
                "flex w-[80px] shrink-0 flex-col items-center gap-2 rounded-2xl p-2 transition-colors",
                selected ? "bg-white/10" : "hover:bg-white/5",
                highlightFirst && i === 0 ? "ring-2 ring-[oklch(0.606_0.219_292.72)] shadow-glow" : "",
              ].join(" ")}
            >
              <CreatorAvatar
                src={c.avatarUrl}
                name={c.displayName}
                selected={selected}
                size={56}
              />
              <span
                className={[
                  "w-full truncate text-center text-[11px] font-semibold",
                  selected ? "text-white" : "text-white/55",
                ].join(" ")}
              >
                {c.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
