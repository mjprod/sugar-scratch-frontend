import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  getScratchZoomEnabled,
  setScratchZoomEnabled,
  subscribeScratchZoom,
  type ScratchZoomMode,
} from "@/services/scratchZoomPref";

/** Pause-menu toggle for the touch zoom on motion and photo cards. */
export function ScratchZoomButton({
  mode,
  className = "game-pause__zoom",
}: {
  mode: ScratchZoomMode;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(() => getScratchZoomEnabled(mode));

  useEffect(
    () =>
      subscribeScratchZoom(() => setEnabled(getScratchZoomEnabled(mode))),
    [mode],
  );

  return (
    <button
      type="button"
      className={`${className}${enabled ? "" : " is-off"}`}
      aria-label={enabled ? "Disable zoom" : "Enable zoom"}
      aria-pressed={enabled}
      onClick={() => setScratchZoomEnabled(mode, !enabled)}
    >
      {enabled ? (
        <ZoomIn aria-hidden="true" size={17} strokeWidth={2.4} />
      ) : (
        <ZoomOut aria-hidden="true" size={17} strokeWidth={2.4} />
      )}
      {enabled ? "Zoom (enabled)" : "Zoom (disabled)"}
    </button>
  );
}
