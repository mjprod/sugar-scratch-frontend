import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { feedbackLabel } from "@/features/game/modules/scratchFrameGeometry";

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

type PlateTune = {
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
  radiusTl: number;
  radiusTr: number;
  radiusBr: number;
  radiusBl: number;
  outlineLayers: boolean;
};

type ToastPreview = "count" | "almost" | "one-left" | "complete";

type DebugState = PlateTune & {
  toastPinned: boolean;
  toastPreview: ToastPreview;
  toastFound: number;
  toastTotal: number;
};

const STORAGE_KEY = "sugar.gameUi.packProgressPlateDebug.v8";
const OPEN_KEY = "sugar.gameUi.packProgressPlateDebug.open.v1";
const TOAST_TOTAL = 12;

const DEFAULTS: DebugState = {
  tintAlpha: 81,
  imageOpacity: 99,
  mixBlend: "normal",
  bgBlend: "multiply",
  bgMaskStart: 100,
  bgMaskEnd: 65,
  bgMaskAngle: 95,
  borderColor: "#f99d76",
  borderWidth: 1,
  borderMaskTop: 100,
  borderMaskMid: 12,
  borderMaskBottom: 40,
  borderMaskAngle: 156,
  radiusTl: 4,
  radiusTr: 11,
  radiusBr: 11,
  radiusBl: 20,
  outlineLayers: false,
  toastPinned: true,
  toastPreview: "count",
  toastFound: 7,
  toastTotal: TOAST_TOTAL,
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

const PP_VAR_KEYS = [
  "--pp-tint",
  "--pp-image-opacity",
  "--pp-mix-blend",
  "--pp-bg-blend",
  "--pp-bg-mask",
  "--pp-border-color",
  "--pp-border-width",
  "--pp-border-mask",
  "--pp-radius-tl",
  "--pp-radius-tr",
  "--pp-radius-br",
  "--pp-radius-bl",
  "--pp-radius",
] as const;

const TOAST_VAR_KEYS = [
  "--toast-tint",
  "--toast-image-opacity",
  "--toast-mix-blend",
  "--toast-bg-blend",
  "--toast-bg-mask",
  "--toast-border-color",
  "--toast-border-width",
  "--toast-border-mask",
  "--toast-radius-tl",
  "--toast-radius-tr",
  "--toast-radius-br",
  "--toast-radius-bl",
  "--toast-radius",
] as const;

function radiusShorthand(d: PlateTune) {
  return `${d.radiusTl}px ${d.radiusTr}px ${d.radiusBr}px ${d.radiusBl}px`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function loadDebug(): DebugState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DebugState>) };
  } catch {
    return DEFAULTS;
  }
}

function loadOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function buildBgMask(d: PlateTune) {
  return `linear-gradient(${d.bgMaskAngle}deg, rgb(255 255 255 / ${d.bgMaskStart / 100}) 0%, rgb(255 255 255 / ${d.bgMaskEnd / 100}) 100%)`;
}

function buildBorderMask(d: PlateTune) {
  const mid =
    d.borderMaskMid <= 0
      ? "transparent 34%"
      : `rgb(255 255 255 / ${d.borderMaskMid / 100}) 34%`;
  return `linear-gradient(${d.borderMaskAngle}deg, rgb(255 255 255 / ${d.borderMaskTop / 100}) 0%, ${mid}, rgb(255 255 255 / ${d.borderMaskBottom / 100}) 100%)`;
}

function packNodes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".pack-progress"));
}

function toastNodes(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".scratch-frame-progress__feedback"),
  );
}

function toastHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-progress-toast-slot]");
}

function foundForPreview(d: DebugState) {
  switch (d.toastPreview) {
    case "almost":
      return 10;
    case "one-left":
      return Math.max(1, d.toastTotal - 1);
    case "complete":
      return d.toastTotal;
    default:
      return clamp(d.toastFound, 1, d.toastTotal);
  }
}

function applyPackVars(d: PlateTune) {
  const radius = radiusShorthand(d);
  const values: Record<(typeof PP_VAR_KEYS)[number], string> = {
    "--pp-tint": `rgb(0 0 0 / ${d.tintAlpha}%)`,
    "--pp-image-opacity": String(d.imageOpacity / 100),
    "--pp-mix-blend": d.mixBlend,
    "--pp-bg-blend": d.bgBlend,
    "--pp-bg-mask": buildBgMask(d),
    "--pp-border-color": d.borderColor,
    "--pp-border-width": `${d.borderWidth}px`,
    "--pp-border-mask": buildBorderMask(d),
    "--pp-radius-tl": `${d.radiusTl}px`,
    "--pp-radius-tr": `${d.radiusTr}px`,
    "--pp-radius-br": `${d.radiusBr}px`,
    "--pp-radius-bl": `${d.radiusBl}px`,
    "--pp-radius": radius,
  };
  for (const el of packNodes()) {
    for (const key of PP_VAR_KEYS) el.style.setProperty(key, values[key]);
    el.style.borderRadius = radius;
  }
  document.documentElement.dataset.ppPlateOutline = d.outlineLayers ? "1" : "0";
}

function applyToastVars(d: PlateTune) {
  const radius = radiusShorthand(d);
  const values: Record<(typeof TOAST_VAR_KEYS)[number], string> = {
    "--toast-tint": `rgb(0 0 0 / ${d.tintAlpha}%)`,
    "--toast-image-opacity": String(d.imageOpacity / 100),
    "--toast-mix-blend": d.mixBlend,
    "--toast-bg-blend": d.bgBlend,
    "--toast-bg-mask": buildBgMask(d),
    "--toast-border-color": d.borderColor,
    "--toast-border-width": `${d.borderWidth}px`,
    "--toast-border-mask": buildBorderMask(d),
    "--toast-radius-tl": `${d.radiusTl}px`,
    "--toast-radius-tr": `${d.radiusTr}px`,
    "--toast-radius-br": `${d.radiusBr}px`,
    "--toast-radius-bl": `${d.radiusBl}px`,
    "--toast-radius": radius,
  };
  for (const el of toastNodes()) {
    for (const key of TOAST_VAR_KEYS) el.style.setProperty(key, values[key]);
    el.style.borderRadius = radius;
  }
  document.documentElement.dataset.toastPlateOutline = d.outlineLayers
    ? "1"
    : "0";
}

function clearPackVars() {
  for (const el of packNodes()) {
    for (const key of PP_VAR_KEYS) el.style.removeProperty(key);
    el.style.removeProperty("border-radius");
  }
  delete document.documentElement.dataset.ppPlateOutline;
}

function clearToastVars() {
  for (const el of toastNodes()) {
    for (const key of TOAST_VAR_KEYS) el.style.removeProperty(key);
    el.style.removeProperty("border-radius");
  }
  delete document.documentElement.dataset.toastPlateOutline;
}

function formatCssSnippet(d: PlateTune) {
  return [
    "/* .pack-progress plate + border — paste into scratch/styles.css */",
    `--pp-tint: rgb(0 0 0 / ${d.tintAlpha}%);`,
    `--pp-image-opacity: ${Number((d.imageOpacity / 100).toFixed(2))};`,
    `--pp-mix-blend: ${d.mixBlend};`,
    `--pp-bg-blend: ${d.bgBlend};`,
    `--pp-bg-mask: ${buildBgMask(d)};`,
    `--pp-border-mask: ${buildBorderMask(d)};`,
    `--pp-border-color: ${d.borderColor};`,
    `--pp-border-width: ${d.borderWidth}px;`,
    `--pp-radius-tl: ${d.radiusTl}px;`,
    `--pp-radius-tr: ${d.radiusTr}px;`,
    `--pp-radius-br: ${d.radiusBr}px;`,
    `--pp-radius-bl: ${d.radiusBl}px;`,
    `--pp-radius: ${radiusShorthand(d)};`,
    "",
    "/* .scratch-frame-progress__feedback toast — same values as --toast-* */",
    `--toast-tint: rgb(0 0 0 / ${d.tintAlpha}%);`,
    `--toast-image-opacity: ${Number((d.imageOpacity / 100).toFixed(2))};`,
    `--toast-mix-blend: ${d.mixBlend};`,
    `--toast-bg-blend: ${d.bgBlend};`,
    `--toast-bg-mask: ${buildBgMask(d)};`,
    `--toast-border-mask: ${buildBorderMask(d)};`,
    `--toast-border-color: ${d.borderColor};`,
    `--toast-border-width: ${d.borderWidth}px;`,
    `--toast-radius-tl: ${d.radiusTl}px;`,
    `--toast-radius-tr: ${d.radiusTr}px;`,
    `--toast-radius-br: ${d.radiusBr}px;`,
    `--toast-radius-bl: ${d.radiusBl}px;`,
    `--toast-radius: ${radiusShorthand(d)};`,
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
 * Live tuner for cards-left badge + find toast plate/border.
 * Mounted on `/game-ui` only. Floating button toggles the panel.
 */
export function PackProgressPlateDebug() {
  const [debug, setDebug] = useState<DebugState>(() => loadDebug());
  const [open, setOpen] = useState(() => loadOpen());
  const [copyLabel, setCopyLabel] = useState("Copy CSS");
  const [toastHostEl, setToastHostEl] = useState<HTMLElement | null>(null);

  const patch = useCallback((partial: Partial<DebugState>) => {
    setDebug((current) => {
      const next = { ...current, ...partial };
      if (partial.tintAlpha != null)
        next.tintAlpha = clamp(partial.tintAlpha, 0, 100);
      if (partial.imageOpacity != null)
        next.imageOpacity = clamp(partial.imageOpacity, 0, 100);
      if (partial.bgMaskStart != null)
        next.bgMaskStart = clamp(partial.bgMaskStart, 0, 100);
      if (partial.bgMaskEnd != null)
        next.bgMaskEnd = clamp(partial.bgMaskEnd, 0, 100);
      if (partial.borderMaskTop != null)
        next.borderMaskTop = clamp(partial.borderMaskTop, 0, 100);
      if (partial.borderMaskMid != null)
        next.borderMaskMid = clamp(partial.borderMaskMid, 0, 100);
      if (partial.borderMaskBottom != null)
        next.borderMaskBottom = clamp(partial.borderMaskBottom, 0, 100);
      if (partial.borderWidth != null)
        next.borderWidth = clamp(partial.borderWidth, 0, 8);
      if (partial.radiusTl != null)
        next.radiusTl = clamp(partial.radiusTl, 0, 48);
      if (partial.radiusTr != null)
        next.radiusTr = clamp(partial.radiusTr, 0, 48);
      if (partial.radiusBr != null)
        next.radiusBr = clamp(partial.radiusBr, 0, 48);
      if (partial.radiusBl != null)
        next.radiusBl = clamp(partial.radiusBl, 0, 48);
      if (partial.toastFound != null)
        next.toastFound = clamp(partial.toastFound, 1, next.toastTotal);
      if (partial.toastTotal != null)
        next.toastTotal = clamp(partial.toastTotal, 1, 24);
      return next;
    });
  }, []);

  useEffect(() => {
    applyPackVars(debug);
    applyToastVars(debug);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(debug));
    } catch {
      /* ignore */
    }
  }, [debug]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    const sync = () => {
      applyPackVars(debug);
      applyToastVars(debug);
      setToastHostEl(toastHost());
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    const id = window.setInterval(sync, 800);
    return () => {
      mo.disconnect();
      window.clearInterval(id);
    };
  }, [debug]);

  useEffect(
    () => () => {
      clearPackVars();
      clearToastVars();
    },
    [],
  );

  const snippet = useMemo(() => formatCssSnippet(debug), [debug]);
  const previewFound = foundForPreview(debug);
  const toastCopy = feedbackLabel(previewFound, debug.toastTotal);

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

  const pinnedToast =
    debug.toastPinned && toastHostEl
      ? createPortal(
          <div
            className={[
              "scratch-frame-progress__feedback",
              "is-lab-pinned",
              toastCopy.primary.startsWith("Almost there")
                ? "is-almost-there"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="polite"
            data-lab-toast="1"
          >
            <strong>{toastCopy.primary}</strong>
            {toastCopy.secondary ? <span>{toastCopy.secondary}</span> : null}
          </div>,
          toastHostEl,
        )
      : null;

  return createPortal(
    <>
      {pinnedToast}
      <button
        type="button"
        className={[
          "pack-progress-debug-fab",
          open ? "is-panel-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={open}
        aria-controls="pack-progress-debug-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide HUD debug" : "HUD badge / toast"}
      </button>

      {open ? (
        <aside
          id="pack-progress-debug-panel"
          className="home-hero-debug home-hero-debug--pack-progress"
          aria-label="Cards left badge and toast plate debug"
        >
          <div className="home-hero-debug__head">
            <p className="home-hero-debug__title">Badge + toast</p>
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
                onClick={() => setOpen(false)}
              >
                Hide
              </button>
            </div>
          </div>

          <div className="home-hero-debug__body">
            <div className="home-hero-debug__section">
              <p className="home-hero-debug__section-title">Find toast</p>
              <p className="home-hero-debug__hint">
                Pin keeps the status-row toast on so you can style plate + border
                without scratching. Same plate knobs apply to cards-left and
                toast.
              </p>
              <label className="home-hero-debug__field home-hero-debug__field--check">
                <span>Pin toast on</span>
                <input
                  type="checkbox"
                  checked={debug.toastPinned}
                  onChange={(event) =>
                    patch({ toastPinned: event.target.checked })
                  }
                />
              </label>
              <label className="home-hero-debug__field">
                <span>Preview copy</span>
                <select
                  value={debug.toastPreview}
                  onChange={(event) =>
                    patch({
                      toastPreview: event.target.value as ToastPreview,
                    })
                  }
                >
                  <option value="count">Count (N / total)</option>
                  <option value="almost">Almost there…</option>
                  <option value="one-left">Only one left!</option>
                  <option value="complete">Complete</option>
                </select>
              </label>
              {debug.toastPreview === "count" ? (
                <SliderField
                  label="Found count"
                  value={debug.toastFound}
                  min={1}
                  max={debug.toastTotal}
                  step={1}
                  suffix=""
                  onChange={(toastFound) => patch({ toastFound })}
                />
              ) : null}
              <p className="home-hero-debug__hint">
                Showing: <strong>{toastCopy.primary}</strong>
                {toastCopy.secondary ? ` · ${toastCopy.secondary}` : ""}
              </p>
            </div>

            <div className="home-hero-debug__section">
              <p className="home-hero-debug__section-title">Transparency</p>
              <p className="home-hero-debug__hint">
                Plate mask vs border mask. White keeps the layer; transparent
                cuts it. Applies to cards-left + toast.
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
              <label className="home-hero-debug__field">
                <span>
                  Color
                  <em>{debug.borderColor}</em>
                </span>
                <input
                  type="color"
                  value={debug.borderColor}
                  onChange={(event) =>
                    patch({ borderColor: event.target.value })
                  }
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
              <p className="home-hero-debug__section-title">Corner radius</p>
              <p className="home-hero-debug__hint">
                Host + plate + border, for both cards-left and toast.
              </p>
              <SliderField
                label="Top left"
                value={debug.radiusTl}
                min={0}
                max={48}
                step={1}
                suffix="px"
                onChange={(radiusTl) => patch({ radiusTl })}
              />
              <SliderField
                label="Top right"
                value={debug.radiusTr}
                min={0}
                max={48}
                step={1}
                suffix="px"
                onChange={(radiusTr) => patch({ radiusTr })}
              />
              <SliderField
                label="Bottom right"
                value={debug.radiusBr}
                min={0}
                max={48}
                step={1}
                suffix="px"
                onChange={(radiusBr) => patch({ radiusBr })}
              />
              <SliderField
                label="Bottom left"
                value={debug.radiusBl}
                min={0}
                max={48}
                step={1}
                suffix="px"
                onChange={(radiusBl) => patch({ radiusBl })}
              />
              <button
                type="button"
                className="home-hero-debug__btn"
                onClick={() =>
                  patch({
                    radiusTl: debug.radiusTl,
                    radiusTr: debug.radiusTl,
                    radiusBr: debug.radiusTl,
                    radiusBl: debug.radiusTl,
                  })
                }
              >
                Match all to top left
              </button>
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
        </aside>
      ) : null}
    </>,
    document.body,
  );
}

export default PackProgressPlateDebug;
