import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type MixBlend =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

type BarPlateDebug = {
  tintAlpha: number;
  imageOpacity: number;
  mixBlend: MixBlend;
  bgBlend: MixBlend;
  bgMaskStart: number;
  bgMaskEnd: number;
  bgMaskAngle: number;
  borderColor: string;
  borderWidth: number;
  borderMaskTop: number;
  borderMaskMid: number;
  borderMaskBottom: number;
  borderMaskAngle: number;
  outlineLayers: boolean;
};

const STORAGE_KEY = "sugar.gameUi.topBarPlateDebug.v5";

const DEFAULTS: BarPlateDebug = {
  tintAlpha: 31,
  imageOpacity: 100,
  mixBlend: "normal",
  bgBlend: "multiply",
  bgMaskStart: 78,
  bgMaskEnd: 88,
  bgMaskAngle: 146,
  borderColor: "#f99d76",
  borderWidth: 1,
  borderMaskTop: 100,
  borderMaskMid: 12,
  borderMaskBottom: 40,
  borderMaskAngle: 165,
  outlineLayers: false,
};

const MIX_BLEND_OPTIONS: MixBlend[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function loadDebug(): BarPlateDebug {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<BarPlateDebug>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function buildBgMask(d: BarPlateDebug) {
  return `linear-gradient(${d.bgMaskAngle}deg, rgb(255 255 255 / ${d.bgMaskStart / 100}) 0%, rgb(255 255 255 / ${d.bgMaskEnd / 100}) 100%)`;
}

function buildBorderMask(d: BarPlateDebug) {
  const mid =
    d.borderMaskMid <= 0
      ? "transparent 34%"
      : `rgb(255 255 255 / ${d.borderMaskMid / 100}) 34%`;
  return `linear-gradient(${d.borderMaskAngle}deg, rgb(255 255 255 / ${d.borderMaskTop / 100}) 0%, ${mid}, rgb(255 255 255 / ${d.borderMaskBottom / 100}) 100%)`;
}

const BAR_VAR_KEYS = [
  "--bar-tint",
  "--bar-image-opacity",
  "--bar-mix-blend",
  "--bar-bg-blend",
  "--bar-bg-mask",
  "--bar-border-color",
  "--bar-border-width",
  "--bar-border-mask",
] as const;

function barNodes(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".symbol-bar, .top-symbol-bar"),
  );
}

function applyBarVars(d: BarPlateDebug) {
  const values: Record<(typeof BAR_VAR_KEYS)[number], string> = {
    "--bar-tint": `rgb(0 0 0 / ${d.tintAlpha}%)`,
    "--bar-image-opacity": String(d.imageOpacity / 100),
    "--bar-mix-blend": d.mixBlend,
    "--bar-bg-blend": d.bgBlend,
    "--bar-bg-mask": buildBgMask(d),
    "--bar-border-color": d.borderColor,
    "--bar-border-width": `${d.borderWidth}px`,
    "--bar-border-mask": buildBorderMask(d),
  };
  for (const el of barNodes()) {
    for (const key of BAR_VAR_KEYS) el.style.setProperty(key, values[key]);
  }
  document.documentElement.dataset.barPlateOutline = d.outlineLayers
    ? "1"
    : "0";
}

function clearBarVars() {
  for (const el of barNodes()) {
    for (const key of BAR_VAR_KEYS) el.style.removeProperty(key);
  }
  delete document.documentElement.dataset.barPlateOutline;
}

function formatCssSnippet(d: BarPlateDebug) {
  return [
    "/* .symbol-bar plate + border — paste into scratch/styles.css */",
    `--bar-tint: rgb(0 0 0 / ${d.tintAlpha}%);`,
    `--bar-image-opacity: ${Number((d.imageOpacity / 100).toFixed(2))};`,
    `--bar-mix-blend: ${d.mixBlend};`,
    `--bar-bg-blend: ${d.bgBlend};`,
    `--bar-bg-mask: ${buildBgMask(d)};`,
    `--bar-border-mask: ${buildBorderMask(d)};`,
    `--bar-border-color: ${d.borderColor};`,
    `--bar-border-width: ${d.borderWidth}px;`,
  ].join("\n");
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="home-hero-debug__field">
      <span>
        {label}
        <em>
          {Number.isInteger(step) ? value : value.toFixed(1)}
          {suffix}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/**
 * Live tuner for the docked top symbol-bar plate + border ring.
 * Mounted on `/game-ui` only. Writes CSS vars on :root so .symbol-bar picks them up.
 */
export function TopBarPlateDebug() {
  const [debug, setDebug] = useState<BarPlateDebug>(() => loadDebug());
  const [open, setOpen] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy CSS");

  const patch = useCallback((partial: Partial<BarPlateDebug>) => {
    setDebug((current) => {
      const next = { ...current, ...partial };
      if (partial.tintAlpha != null) next.tintAlpha = clamp(partial.tintAlpha, 0, 100);
      if (partial.imageOpacity != null)
        next.imageOpacity = clamp(partial.imageOpacity, 0, 100);
      if (partial.bgMaskStart != null)
        next.bgMaskStart = clamp(partial.bgMaskStart, 0, 100);
      if (partial.bgMaskEnd != null) next.bgMaskEnd = clamp(partial.bgMaskEnd, 0, 100);
      if (partial.borderMaskTop != null)
        next.borderMaskTop = clamp(partial.borderMaskTop, 0, 100);
      if (partial.borderMaskMid != null)
        next.borderMaskMid = clamp(partial.borderMaskMid, 0, 100);
      if (partial.borderMaskBottom != null)
        next.borderMaskBottom = clamp(partial.borderMaskBottom, 0, 100);
      if (partial.borderWidth != null)
        next.borderWidth = clamp(partial.borderWidth, 0, 8);
      return next;
    });
  }, []);

  useEffect(() => {
    applyBarVars(debug);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(debug));
    } catch {
      /* ignore quota */
    }
  }, [debug]);

  // Bar mounts after first paint / phase changes — re-apply when nodes appear.
  useEffect(() => {
    const mo = new MutationObserver(() => applyBarVars(debug));
    mo.observe(document.body, { childList: true, subtree: true });
    const id = window.setInterval(() => applyBarVars(debug), 800);
    return () => {
      mo.disconnect();
      window.clearInterval(id);
    };
  }, [debug]);

  useEffect(() => () => clearBarVars(), []);

  const snippet = useMemo(() => formatCssSnippet(debug), [debug]);

  async function copyCss() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    window.setTimeout(() => setCopyLabel("Copy CSS"), 1600);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <aside
      className={[
        "home-hero-debug",
        "home-hero-debug--top-bar",
        open ? "" : "is-collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Top bar plate debug"
    >
      <div className="home-hero-debug__head">
        <p className="home-hero-debug__title">Top bar plate</p>
        <div className="home-hero-debug__actions">
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => setDebug(DEFAULTS)}
          >
            Reset
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => void copyCss()}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            className="home-hero-debug__btn"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="home-hero-debug__body">
          <div className="home-hero-debug__section">
            <p className="home-hero-debug__section-title">Transparency</p>
            <p className="home-hero-debug__hint">
              Tint = black plate under frostedglass.webp. Image opacity fades the
              texture. Mask whites keep the plate; blacks/transparent cut it.
            </p>
            <SliderField
              label="Tint alpha"
              value={debug.tintAlpha}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(tintAlpha) => patch({ tintAlpha })}
            />
            <SliderField
              label="Image opacity"
              value={debug.imageOpacity}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(imageOpacity) => patch({ imageOpacity })}
            />
            <SliderField
              label="BG mask start"
              value={debug.bgMaskStart}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(bgMaskStart) => patch({ bgMaskStart })}
            />
            <SliderField
              label="BG mask end"
              value={debug.bgMaskEnd}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(bgMaskEnd) => patch({ bgMaskEnd })}
            />
            <SliderField
              label="BG mask angle"
              value={debug.bgMaskAngle}
              min={0}
              max={360}
              step={1}
              suffix="°"
              onChange={(bgMaskAngle) => patch({ bgMaskAngle })}
            />
            <label className="home-hero-debug__field">
              <span>Mix blend</span>
              <select
                value={debug.mixBlend}
                onChange={(event) =>
                  patch({ mixBlend: event.target.value as MixBlend })
                }
              >
                {MIX_BLEND_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label className="home-hero-debug__field">
              <span>BG blend</span>
              <select
                value={debug.bgBlend}
                onChange={(event) =>
                  patch({ bgBlend: event.target.value as MixBlend })
                }
              >
                {MIX_BLEND_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="home-hero-debug__section">
            <p className="home-hero-debug__section-title">Border ring</p>
            <p className="home-hero-debug__hint">
              Separate ::after stroke. Mask mid at 0% = transparent gap (default
              look). Raise mid to fill the side stroke.
            </p>
            <label className="home-hero-debug__field">
              <span>
                Color
                <em>{debug.borderColor}</em>
              </span>
              <input
                type="color"
                value={debug.borderColor}
                onChange={(event) => patch({ borderColor: event.target.value })}
              />
            </label>
            <SliderField
              label="Width"
              value={debug.borderWidth}
              min={0}
              max={8}
              step={0.5}
              suffix="px"
              onChange={(borderWidth) => patch({ borderWidth })}
            />
            <SliderField
              label="Mask top"
              value={debug.borderMaskTop}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(borderMaskTop) => patch({ borderMaskTop })}
            />
            <SliderField
              label="Mask mid"
              value={debug.borderMaskMid}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(borderMaskMid) => patch({ borderMaskMid })}
            />
            <SliderField
              label="Mask bottom"
              value={debug.borderMaskBottom}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(borderMaskBottom) => patch({ borderMaskBottom })}
            />
            <SliderField
              label="Mask angle"
              value={debug.borderMaskAngle}
              min={0}
              max={360}
              step={1}
              suffix="°"
              onChange={(borderMaskAngle) => patch({ borderMaskAngle })}
            />
          </div>

          <div className="home-hero-debug__section">
            <label className="home-hero-debug__field home-hero-debug__field--check">
              <span>Outline plate / border layers</span>
              <input
                type="checkbox"
                checked={debug.outlineLayers}
                onChange={(event) =>
                  patch({ outlineLayers: event.target.checked })
                }
              />
            </label>
            <pre className="home-hero-debug__code">{snippet}</pre>
          </div>
        </div>
      ) : null}
    </aside>,
    document.body,
  );
}

export default TopBarPlateDebug;
