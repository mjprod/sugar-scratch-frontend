import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  getFrameStartLabState,
  setFrameStartLabState,
  subscribeFrameStartLab,
} from "@/features/game/modules/frameStartLab";

const STORAGE_KEY = "sugar.gameUi.frameStart.v2";
const FRAME_START_MAX = 1.5;
const DEFAULT_FRAME_START = 0.178;

function clampFrameStart(n: number) {
  return Math.min(FRAME_START_MAX, Math.max(0, n));
}

function readStoredStart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_FRAME_START;
    const n = Number(raw);
    return Number.isFinite(n) ? clampFrameStart(n) : DEFAULT_FRAME_START;
  } catch {
    return DEFAULT_FRAME_START;
  }
}

/**
 * Lab-only: start-origin slider for the progress frame.
 * Drives frameStartLab (React state), not CSS vars alone — so rotation always applies.
 */
export function GameUiFrameStartDebug() {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(DEFAULT_FRAME_START);
  const [previewProgress, setPreviewProgress] = useState(0.35);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = readStoredStart();
    setStart(stored);
    setFrameStartLabState({ start: stored });
  }, []);

  useEffect(() => {
    return subscribeFrameStartLab(() => {
      const next = getFrameStartLabState();
      setStart(next.start);
      setPreviewProgress(next.previewProgress);
      setOpen(next.previewOpen);
    });
  }, []);

  // Push local edits into the shared lab store (ScratchFrameProgress reads this).
  useEffect(() => {
    setFrameStartLabState({
      start,
      previewProgress: open ? previewProgress : 0,
      previewOpen: open,
    });
    try {
      localStorage.setItem(STORAGE_KEY, String(start));
    } catch {
      /* ignore */
    }
  }, [start, previewProgress, open]);

  const startPct = Math.round(start * 1000) / 10;
  const snippet = useMemo(
    () =>
      `--frame-start: ${start.toFixed(4)}; /* ${startPct}% around path, 0 = top-left */`,
    [start, startPct],
  );

  async function copyValue(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="game-ui-frame-start-debug"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 99999,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        pointerEvents: "auto",
      }}
    >
      {open ? (
        <div
          style={{
            width: 300,
            marginBottom: 10,
            padding: 12,
            borderRadius: 14,
            background: "rgb(18 14 24 / 96%)",
            border: "1px solid rgb(255 210 242 / 28%)",
            boxShadow: "0 12px 32px rgb(0 0 0 / 45%)",
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 13, letterSpacing: "0.02em" }}>
              Frame start
            </strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={chipBtn}
            >
              Close
            </button>
          </div>

          <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.7 }}>
            Start origin rotates the arc. Keep preview fill around 35–65% so you
            can see it move. Full closed = solid ring (start has no look).
          </p>

          <p style={sectionLabel}>Preview arc fill</p>
          <label style={sliderRow}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(previewProgress * 100)}
              onChange={(e) =>
                setPreviewProgress(Number(e.currentTarget.value) / 100)
              }
              style={{ width: "100%" }}
            />
            <span
              style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(previewProgress * 100)}%
            </span>
          </label>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Off", value: 0 },
              { label: "35%", value: 0.35 },
              { label: "65%", value: 0.65 },
              { label: "Full closed", value: 1 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                style={miniBtn}
                onClick={() => setPreviewProgress(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p style={sectionLabel}>Start origin</p>
          <label style={sliderRow}>
            <input
              type="range"
              min={0}
              max={1500}
              value={Math.round(start * 1000)}
              onChange={(e) =>
                setStart(clampFrameStart(Number(e.currentTarget.value) / 1000))
              }
              style={{ width: "100%" }}
            />
            <span
              style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
            >
              {startPct.toFixed(1)}%
            </span>
          </label>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {[
              { label: "Top-left 0%", value: 0 },
              { label: "Top mid", value: 0.125 },
              { label: "Top-right", value: 0.25 },
              { label: "Bottom", value: 0.5 },
              { label: "Left mid", value: 0.875 },
              { label: "100%", value: 1 },
              { label: "125%", value: 1.25 },
              { label: "150%", value: 1.5 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                style={miniBtn}
                onClick={() => setStart(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>Copy this</span>
            <textarea
              readOnly
              value={snippet}
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                borderRadius: 8,
                border: "1px solid rgb(255 255 255 / 0.18)",
                background: "rgb(0 0 0 / 35%)",
                color: "white",
                font: '11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                padding: 8,
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => void copyValue(snippet)}
              style={{ ...chipBtn, flex: 1 }}
            >
              {copied ? "Copied" : "Copy value"}
            </button>
            <button
              type="button"
              onClick={() => setStart(DEFAULT_FRAME_START)}
              style={{ ...chipBtn, flex: 1 }}
            >
              Reset
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.55 }}>
            You should see the pink arc jump around the border as start moves.
            Paste --frame-start back in chat when happy.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open frame start debug"
        style={{
          display: "grid",
          placeItems: "center",
          width: 48,
          height: 48,
          marginLeft: "auto",
          borderRadius: 999,
          border: "1px solid rgb(255 210 242 / 35%)",
          background: open ? "rgb(255 255 255 / 0.9)" : "rgb(28 18 32 / 92%)",
          color: open ? "#111" : "white",
          boxShadow: "0 8px 24px rgb(0 0 0 / 35%)",
          cursor: "pointer",
          fontWeight: 800,
          fontSize: 10,
          letterSpacing: "0.04em",
        }}
      >
        START
      </button>
    </div>
  );
}

const chipBtn: CSSProperties = {
  border: "1px solid rgb(255 255 255 / 0.2)",
  background: "rgb(255 255 255 / 0.08)",
  color: "white",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const miniBtn: CSSProperties = {
  ...chipBtn,
  padding: "5px 8px",
  fontSize: 11,
};

const sectionLabel: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  opacity: 0.65,
};

const sliderRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 52px",
  gap: 8,
  alignItems: "center",
  marginBottom: 8,
  fontSize: 12,
};
