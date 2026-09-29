import { useEffect, useState } from "react";
import {
  SOUND_MIX_CHANNELS,
  SOUND_MIX_LABELS,
  clearSoundMixStorage,
  formatSoundMix,
  getSoundMix,
  setSoundMixGain,
  subscribeSoundMix,
  type SoundMixChannel,
} from "./soundMix";

const STEP = 0.05;

/**
 * On-page mixer. +/- instead of range inputs: the scratch stage sets
 * touch-action:none, so iOS never delivers a drag to a native slider thumb.
 */
export function SoundMixDebug() {
  const [mix, setMix] = useState(getSoundMix);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeSoundMix(() => setMix({ ...getSoundMix() })), []);

  async function copy() {
    const text = formatSoundMix();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this mix:", text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: "max(8px, env(safe-area-inset-bottom))",
        zIndex: 2147483647,
        width: open ? 230 : "auto",
        padding: 8,
        borderRadius: 12,
        background: "rgba(12, 8, 16, 0.92)",
        color: "#fff",
        font: "13px/1.2 system-ui, sans-serif",
        pointerEvents: "auto",
        touchAction: "manipulation",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <Tap onClick={() => setOpen((value) => !value)}>{open ? "Hide mix" : "Sound mix"}</Tap>
        {open ? <Tap onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</Tap> : null}
        {open ? <Tap onClick={clearSoundMixStorage}>Clear</Tap> : null}
      </div>
      {open
        ? SOUND_MIX_CHANNELS.map((channel) => (
            <MixRow key={channel} channel={channel} value={mix[channel]} />
          ))
        : null}
    </div>
  );
}

function MixRow({ channel, value }: { channel: SoundMixChannel; value: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: 6,
        alignItems: "center",
        marginTop: 6,
      }}
    >
      <span style={{ minWidth: 0 }}>{SOUND_MIX_LABELS[channel]}</span>
      <Tap onClick={() => setSoundMixGain(channel, value - STEP)}>−</Tap>
      <span style={{ width: 36, textAlign: "right" }}>{value.toFixed(2)}</span>
      <Tap onClick={() => setSoundMixGain(channel, value + STEP)}>+</Tap>
    </div>
  );
}

function Tap({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      style={{
        minWidth: 36,
        minHeight: 36,
        padding: "6px 8px",
        border: 0,
        borderRadius: 8,
        background: "#fff",
        color: "#111",
        font: "inherit",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}
