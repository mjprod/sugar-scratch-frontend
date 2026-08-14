import type { ThemeSummary } from "@/services/homeFeed";

/** `all` = All Themes filter for selected creator */
export function ThemeFilter({
  creatorName,
  themes,
  selectedId,
  onSelect,
}: {
  creatorName: string;
  themes: ThemeSummary[];
  selectedId: string | null;
  onSelect: (id: string | "all") => void;
}) {
  const active = selectedId ?? "all";

  return (
    <div>
      <h2 className="text-[13px] font-semibold tracking-wide text-white/45 uppercase">
        Themes · {creatorName}
      </h2>
      <div
        className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Theme filter"
      >
        <ThemeChip
          label="All Themes"
          selected={active === "all"}
          onClick={() => onSelect("all")}
        />
        {themes.map((t) => (
          <ThemeChip
            key={t.id}
            label={t.displayName}
            selected={active === t.id}
            disabled={!t.isAvailable}
            onClick={() => {
              if (t.id === selectedId) return;
              onSelect(t.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
        selected
          ? "bg-[oklch(0.606_0.219_292.72)] text-white shadow-[0_8px_20px_oklch(0.606_0.219_292.72_/_0.35)]"
          : "border border-white/[0.08] bg-white/[0.05] text-white/65 hover:bg-white/10",
        disabled ? "opacity-40" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
