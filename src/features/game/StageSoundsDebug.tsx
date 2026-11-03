import { useEffect, useId, useState } from "react";
import { useLocation } from "react-router-dom";
import { resolvePerfHudEnabled } from "@/lib/perf/perfStats";
import {
  SOUND_MIX_CHANNELS,
  SOUND_MIX_LABELS,
  formatSoundMixReport,
  getSoundMix,
  resetSoundMix,
  setSoundMixGain,
  subscribeSoundMix,
  type SoundMix,
  type SoundMixChannel,
} from "./shared/soundMix";
import "./StageSoundsDebug.css";

/** iOS Safari often rejects clipboard.writeText outside a trusted path — fallback. */
async function copyTextIosSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Sounds mixer for /game (and audio-test). Visible only with `?perf=1`
 * (same latch as the perf HUD). Left-edge "Sounds" opens a right sheet with
 * per-channel touch sliders, Reset, and Copy for pasteback.
 */
export function StageSoundsDebug() {
  const { search } = useLocation();
  const enabled = resolvePerfHudEnabled(
    search,
    typeof window !== "undefined" ? window.localStorage : null,
  );
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mix, setMix] = useState<SoundMix>(() => getSoundMix());
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    if (!enabled) return;
    return subscribeSoundMix(() => setMix(getSoundMix()));
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, open]);

  if (!enabled) return null;

  function onSlider(channel: SoundMixChannel, raw: string) {
    setSoundMixGain(channel, Number(raw));
  }

  async function onCopy() {
    const text = formatSoundMixReport(getSoundMix());
    console.info(text);
    const ok = await copyTextIosSafe(text);
    setCopyState(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  return (
    <div className="stage-sounds-debug" data-open={open ? "1" : undefined}>
      <button
        type="button"
        className="stage-sounds-debug__toggle"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        Sounds
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="stage-sounds-debug__scrim"
            aria-label="Close sounds menu"
            onClick={() => setOpen(false)}
          />
          <aside
            className="stage-sounds-debug__sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="stage-sounds-debug__head">
              <h2 id={titleId} className="stage-sounds-debug__title">
                Sounds
              </h2>
              <button
                type="button"
                className="stage-sounds-debug__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <ul className="stage-sounds-debug__list">
              {SOUND_MIX_CHANNELS.map((channel) => {
                const value = mix[channel];
                const labelId = `${titleId}-${channel}`;
                return (
                  <li key={channel} className="stage-sounds-debug__row">
                    <div className="stage-sounds-debug__row-meta">
                      <label
                        id={labelId}
                        htmlFor={`${labelId}-range`}
                        className="stage-sounds-debug__label"
                      >
                        {SOUND_MIX_LABELS[channel]}
                      </label>
                      <span className="stage-sounds-debug__value tabular-nums">
                        {value.toFixed(2)}
                      </span>
                    </div>
                    <input
                      id={`${labelId}-range`}
                      className="stage-sounds-debug__slider"
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={value}
                      aria-labelledby={labelId}
                      onChange={(event) =>
                        onSlider(channel, event.currentTarget.value)
                      }
                    />
                  </li>
                );
              })}
            </ul>

            <div className="stage-sounds-debug__actions">
              <button
                type="button"
                className="stage-sounds-debug__action"
                onClick={() => resetSoundMix()}
              >
                Reset
              </button>
              <button
                type="button"
                className="stage-sounds-debug__action is-primary"
                onClick={() => void onCopy()}
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy"}
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
