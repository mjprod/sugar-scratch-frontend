import { LayoutGrid, Layers } from "lucide-react";

export type ViewMode = "grid" | "carousel";

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="cpv2-mode-toggle" role="group" aria-label="Theme view mode">
      <button
        type="button"
        className={["cpv2-mode-btn", value === "carousel" ? "is-active" : ""].join(" ")}
        aria-label="Carousel view"
        aria-pressed={value === "carousel"}
        onClick={() => {
          if (value !== "carousel") onChange("carousel");
        }}
      >
        <Layers className="size-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={["cpv2-mode-btn", value === "grid" ? "is-active" : ""].join(" ")}
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => {
          if (value !== "grid") onChange("grid");
        }}
      >
        <LayoutGrid className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}
