import { Package } from "lucide-react";
import type { ThemeCardData } from "../../flow/collection";

const BAR = {
  pink: "cpv2-bar-pink",
  neutral: "cpv2-bar-neutral",
} as const;

export function ThemeSelector({
  themes,
  selectedThemeId,
  onSelect,
}: {
  themes: ThemeCardData[];
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
}) {
  return (
    <div className="cpv2-theme-chips" role="listbox" aria-label="Themes">
      {themes.map((theme) => {
        const selected = theme.id === selectedThemeId;
        const pct = Math.round((theme.collected / theme.total) * 100);
        return (
          <button
            key={theme.id}
            type="button"
            role="option"
            aria-selected={selected}
            className={["cpv2-theme-chip", selected ? "is-selected" : ""].join(" ")}
            onClick={() => onSelect(theme.id)}
          >
            <div className="cpv2-theme-chip-media">
              <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
              <div className="cpv2-theme-chip-shade" />
              {theme.badge?.type === "pack-count" && theme.badge.value ? (
                <span className="cpv2-chip-badge" aria-label={`${theme.badge.value} packs`}>
                  <Package className="size-3" aria-hidden="true" />
                  <span>{theme.badge.value}</span>
                </span>
              ) : null}
              {theme.badge?.type === "alert" ? (
                <span className="cpv2-chip-badge is-alert">!</span>
              ) : null}
              <div className="cpv2-theme-chip-copy">
                <p className="cpv2-theme-chip-name">{theme.name}</p>
                <p className="cpv2-theme-chip-count">
                  {theme.collected} / {theme.total}
                </p>
                <div className="cpv2-theme-chip-bar">
                  <div
                    className={selected ? BAR.pink : BAR.neutral}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
