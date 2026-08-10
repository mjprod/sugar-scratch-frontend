import { useMemo, useState, type CSSProperties } from "react";
import {
  Compass,
  Gift,
  Home,
  Layers3,
  User,
  type LucideIcon,
} from "lucide-react";
import { BorderGlow } from "@/components/ui/BorderGlow";

type NavTestTab = "home" | "browse" | "collection" | "rewards" | "profile";

type TabConfig = {
  id: NavTestTab;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

const TABS: TabConfig[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Browse", icon: Compass },
  { id: "collection", label: "Collection", icon: Layers3, primary: true },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "profile", label: "Profile", icon: User },
];

/**
 * Source: /public/svg/bottomNavClip.svg (viewBox 0 0 512.2 106.5)
 *
 * IMPORTANT: clip-path does NOT reliably clip backdrop-filter (blur stays
 * rectangular). mask-image with this SVG works for glass silhouettes.
 * White-filled data URI so luminance masking is solid (file fill is decorative).
 */
const DOCK_PATH =
  "M470.5,23.6h-173.6C288.7,9.5,273.5,0,256.1,0s-32.6,9.4-40.8,23.5H41.7C18.8,23.6.2,42.1.2,65H.2c0,22.9,18.6,41.5,41.5,41.5h428.9c22.9,0,41.5-18.6,41.5-41.5h0c0-22.9-18.6-41.5-41.5-41.5h0Z";

// Symmetric bleed around the path so left/right caps aren't clipped by mask AA
// or a one-sided viewBox stretch (path lives ~0.2 → 512.1 in a 512.2 artboard).
const DOCK_VIEWBOX = "-2 -1 516.2 108.5";
const DOCK_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${DOCK_VIEWBOX}" preserveAspectRatio="none"><path fill="white" d="${DOCK_PATH}"/></svg>`,
)}")`;

const COVER_IMAGE =
  "https://fastly.picsum.photos/id/1043/200/200.jpg?hmac=i7xbST4bM6KMg5XsUaVYvDgwvsZ3VskoXKRqGf1BjcU";

/** Exactly 3 mesh colors for Collection BorderGlow rim */
const COLLECTION_GLOW_COLORS = ["#ff8fb1", "#f472b6", "#c084fc"] as const;

/** Locked Collection glow center cutout */
const CUTOUT = {
  offsetX: 50.5,
  offsetY: 52,
  size: 62,
  feather: 72,
  edgeScale: 0.63,
} as const;

const CUTOUT_STYLE = {
  ["--cutout-x" as string]: `${CUTOUT.offsetX}%`,
  ["--cutout-y" as string]: `${CUTOUT.offsetY}%`,
  ["--cutout-size" as string]: `${CUTOUT.size}%`,
  ["--cutout-feather" as string]: `${Math.max(CUTOUT.size, CUTOUT.feather)}%`,
  ["--cutout-edge-size" as string]: `${Math.max(1, CUTOUT.size * CUTOUT.edgeScale)}%`,
  ["--cutout-edge-feather" as string]: `${Math.max(
    CUTOUT.size * CUTOUT.edgeScale + 1,
    Math.max(CUTOUT.size, CUTOUT.feather) * CUTOUT.edgeScale,
  )}%`,
};

type RimId = "a" | "c" | "brA" | "brC";

type RimLayerDebug = {
  x: number;
  y: number;
  /** Layer height in px (overrides shared base height when set) */
  height: number;
  scale: number;
  opacity: number;
};

type RimBaseDebug = {
  left: number;
  right: number;
  bottom: number;
  height: number;
};

type RimDebugState = {
  base: RimBaseDebug;
  layers: Record<RimId, RimLayerDebug>;
};

const RIM_META: { id: RimId; label: string; className: string }[] = [
  { id: "a", label: "Left soft (rim-a)", className: "nav-test-dock-rim-a" },
  { id: "c", label: "Left crisp (rim-c)", className: "nav-test-dock-rim-c" },
  { id: "brA", label: "BR soft (rim-br-a)", className: "nav-test-dock-rim-br-a" },
  { id: "brC", label: "BR crisp (rim-br-c)", className: "nav-test-dock-rim-br-c" },
];

/** Locked rim layout from debug panel. */
const DEFAULT_RIM_DEBUG: RimDebugState = {
  base: { left: -3, right: -3, bottom: 13, height: 87 },
  layers: {
    a: { x: 60.5, y: -11, height: 60, scale: 1.4, opacity: 0.68 },
    c: { x: 0.5, y: 5, height: 94, scale: 1, opacity: 0.9 },
    brA: { x: -34, y: 2.5, height: 91, scale: 1, opacity: 0.64 },
    brC: { x: -36, y: 4, height: 91.5, scale: 1, opacity: 0.9 },
  },
};

function rimLayerStyle(layer: RimLayerDebug): CSSProperties {
  return {
    ["--rim-x" as string]: `${layer.x}px`,
    ["--rim-y" as string]: `${layer.y}px`,
    ["--rim-layer-height" as string]: `${layer.height}px`,
    ["--rim-scale" as string]: String(layer.scale),
    ["--rim-opacity" as string]: String(layer.opacity),
  };
}

function rimBaseStyle(base: RimBaseDebug): CSSProperties {
  return {
    ["--rim-left" as string]: `${base.left}px`,
    ["--rim-right" as string]: `${base.right}px`,
    ["--rim-bottom" as string]: `${base.bottom}px`,
    ["--rim-height" as string]: `${base.height}px`,
  };
}

function buildRimExport(state: RimDebugState) {
  const cssLines = [
    "/* Shared rim box */",
    `.nav-test-dock-rim {`,
    `  left: ${state.base.left}px;`,
    `  right: ${state.base.right}px;`,
    `  bottom: ${state.base.bottom}px;`,
    `  height: ${state.base.height}px;`,
    `}`,
    "",
  ];

  for (const meta of RIM_META) {
    const layer = state.layers[meta.id];
    cssLines.push(
      `.${meta.className} {`,
      `  height: ${layer.height}px;`,
      `  transform: translate(${layer.x}px, ${layer.y}px) scale(${layer.scale});`,
      `  opacity: ${layer.opacity};`,
      `}`,
      "",
    );
  }

  return {
    json: state,
    css: cssLines.join("\n"),
  };
}

export function NavTestPage() {
  const [active, setActive] = useState<NavTestTab>("home");
  const [rimDebug, setRimDebug] = useState<RimDebugState>(DEFAULT_RIM_DEBUG);
  const [activeRim, setActiveRim] = useState<RimId>("a");
  const [copyMsg, setCopyMsg] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);

  const rimExport = useMemo(() => buildRimExport(rimDebug), [rimDebug]);
  const baseStyle = rimBaseStyle(rimDebug.base);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`Copied ${label}`);
    } catch {
      setCopyMsg("Copy failed — select text manually");
    }
    window.setTimeout(() => setCopyMsg(""), 1600);
  }

  function setBase<K extends keyof RimBaseDebug>(key: K, value: number) {
    setRimDebug((prev) => ({
      ...prev,
      base: { ...prev.base, [key]: value },
    }));
  }

  function setLayer<K extends keyof RimLayerDebug>(
    id: RimId,
    key: K,
    value: number,
  ) {
    setRimDebug((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [id]: { ...prev.layers[id], [key]: value },
      },
    }));
  }

  const layer = rimDebug.layers[activeRim];

  return (
    <section className="nav-test">
      <style>{NAV_TEST_CSS}</style>

      <div
        className="nav-test-cover"
        style={{ backgroundImage: `url(${COVER_IMAGE})` }}
        role="img"
        aria-label={`${active} cover background`}
      />

      {panelOpen ? (
        <aside className="nav-test-rim-debug" aria-label="Rim light debug controls">
          <header className="nav-test-rim-debug-header">
            <div>
              <strong>Rim lights</strong>
              <span>scale · transform · position</span>
            </div>
            <button
              type="button"
              className="nav-test-rim-debug-hide"
              onClick={() => setPanelOpen(false)}
            >
              Hide
            </button>
          </header>

          <p className="nav-test-rim-debug-section">Shared box</p>
          <label className="nav-test-rim-debug-row">
            <span>Left px</span>
            <input
              type="range"
              min={-20}
              max={20}
              step={0.5}
              value={rimDebug.base.left}
              onChange={(e) => setBase("left", Number(e.target.value))}
            />
            <em>{rimDebug.base.left}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Right px</span>
            <input
              type="range"
              min={-20}
              max={20}
              step={0.5}
              value={rimDebug.base.right}
              onChange={(e) => setBase("right", Number(e.target.value))}
            />
            <em>{rimDebug.base.right}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Bottom px</span>
            <input
              type="range"
              min={-10}
              max={40}
              step={0.5}
              value={rimDebug.base.bottom}
              onChange={(e) => setBase("bottom", Number(e.target.value))}
            />
            <em>{rimDebug.base.bottom}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Height px</span>
            <input
              type="range"
              min={60}
              max={120}
              step={0.5}
              value={rimDebug.base.height}
              onChange={(e) => setBase("height", Number(e.target.value))}
            />
            <em>{rimDebug.base.height}</em>
          </label>

          <p className="nav-test-rim-debug-section">Layer</p>
          <div className="nav-test-rim-debug-tabs">
            {RIM_META.map((meta) => (
              <button
                key={meta.id}
                type="button"
                className={activeRim === meta.id ? "is-active" : ""}
                onClick={() => setActiveRim(meta.id)}
              >
                {meta.id}
              </button>
            ))}
          </div>
          <p className="nav-test-rim-debug-layer-name">
            {RIM_META.find((m) => m.id === activeRim)?.label}
          </p>

          <label className="nav-test-rim-debug-row">
            <span>X px</span>
            <input
              type="range"
              min={-120}
              max={120}
              step={0.5}
              value={layer.x}
              onChange={(e) => setLayer(activeRim, "x", Number(e.target.value))}
            />
            <em>{layer.x}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Y px</span>
            <input
              type="range"
              min={-120}
              max={120}
              step={0.5}
              value={layer.y}
              onChange={(e) => setLayer(activeRim, "y", Number(e.target.value))}
            />
            <em>{layer.y}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Height px</span>
            <input
              type="range"
              min={60}
              max={120}
              step={0.5}
              value={layer.height}
              onChange={(e) =>
                setLayer(activeRim, "height", Number(e.target.value))
              }
            />
            <em>{layer.height}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Scale</span>
            <input
              type="range"
              min={0.7}
              max={3}
              step={0.01}
              value={layer.scale}
              onChange={(e) =>
                setLayer(activeRim, "scale", Number(e.target.value))
              }
            />
            <em>{layer.scale.toFixed(2)}</em>
          </label>
          <label className="nav-test-rim-debug-row">
            <span>Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layer.opacity}
              onChange={(e) =>
                setLayer(activeRim, "opacity", Number(e.target.value))
              }
            />
            <em>{layer.opacity.toFixed(2)}</em>
          </label>

          <div className="nav-test-rim-debug-actions">
            <button
              type="button"
              onClick={() =>
                copyText("JSON", JSON.stringify(rimExport.json, null, 2))
              }
            >
              Copy JSON
            </button>
            <button
              type="button"
              onClick={() => copyText("CSS", rimExport.css)}
            >
              Copy CSS
            </button>
            <button
              type="button"
              onClick={() => setRimDebug(DEFAULT_RIM_DEBUG)}
            >
              Reset
            </button>
          </div>

          {copyMsg ? <p className="nav-test-rim-debug-msg">{copyMsg}</p> : null}

          <pre className="nav-test-rim-debug-pre">
            {JSON.stringify(rimExport.json, null, 2)}
          </pre>
        </aside>
      ) : (
        <button
          type="button"
          className="nav-test-rim-debug-show"
          onClick={() => setPanelOpen(true)}
        >
          Rim debug
        </button>
      )}

      <nav
        className="nav-test-dock"
        style={baseStyle}
        aria-label="Experimental bottom navigation"
      >
        {/*
          Glass fill — SVG mask-image from public/svg/bottomNavClip.svg
          (not clip-path) so backdrop-filter is shaped.
        */}
        <div
          className="nav-test-dock-surface"
          style={{
            maskImage: DOCK_MASK,
            WebkitMaskImage: DOCK_MASK,
          }}
          aria-hidden="true"
        />

        {/*
          White stroke rims — same path as the mask.
          Transforms driven by debug CSS vars.
        */}
        <svg
          className="nav-test-dock-rim nav-test-dock-rim-a"
          viewBox={DOCK_VIEWBOX}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={rimLayerStyle(rimDebug.layers.a)}
        >
          <path
            d={DOCK_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <svg
          className="nav-test-dock-rim nav-test-dock-rim-c"
          viewBox={DOCK_VIEWBOX}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={rimLayerStyle(rimDebug.layers.c)}
        >
          <path
            d={DOCK_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Bottom-right rim light — soft + crisp, masked to BR corner */}
        <svg
          className="nav-test-dock-rim nav-test-dock-rim-br-a"
          viewBox={DOCK_VIEWBOX}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={rimLayerStyle(rimDebug.layers.brA)}
        >
          <path
            d={DOCK_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <svg
          className="nav-test-dock-rim nav-test-dock-rim-br-c"
          viewBox={DOCK_VIEWBOX}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={rimLayerStyle(rimDebug.layers.brC)}
        >
          <path
            d={DOCK_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="nav-test-dock-items">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;

            if (tab.primary) {
              return (
                <div
                  key={tab.id}
                  className={[
                    "nav-test-dock-primary",
                    isActive ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <BorderGlow
                    className="nav-test-dock-primary-glow nav-test-hero-btn border-glow-always-on"
                    borderRadius={999}
                    backgroundColor="transparent"
                    glowColor="330 90 78"
                    glowRadius={21}
                    glowIntensity={1.05}
                    coneSpread={28}
                    edgeSensitivity={0}
                    fillOpacity={0.2}
                    animated={false}
                    orbit
                    orbitDuration={7}
                    colors={[...COLLECTION_GLOW_COLORS]}
                    style={CUTOUT_STYLE}
                  >
                    <button
                      type="button"
                      className="nav-test-dock-primary-btn"
                      aria-current={isActive ? "page" : undefined}
                      aria-label={tab.label}
                      onClick={() => setActive(tab.id)}
                    >
                      <Icon
                        className="nav-test-dock-primary-icon"
                        aria-hidden="true"
                      />
                    </button>
                  </BorderGlow>
                  <span className="nav-test-dock-primary-label" aria-hidden="true">
                    {tab.label}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                className={["nav-test-dock-item", isActive ? "is-active" : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                onClick={() => setActive(tab.id)}
              >
                <Icon
                  className="nav-test-dock-icon"
                  strokeWidth={isActive ? 2.1 : 1.8}
                  fill={isActive ? "currentColor" : "none"}
                  fillOpacity={isActive ? 0.2 : 0}
                  aria-hidden="true"
                />
                <span className="nav-test-dock-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}

const NAV_TEST_CSS = `
.nav-test {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  /* visible so dock rims / mask bleed aren't clipped at the page edge */
  overflow: visible;
  background: #0c0c0e;
}

/* Full-bleed cover behind the dock */
.nav-test-cover {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

/* ── Experimental dock ─────────────────────────────────────────── */
.nav-test-dock {
  position: fixed;
  /* Extra side inset so the rounded caps + rim stroke aren't viewport-clipped */
  right: max(18px, env(safe-area-inset-right, 0px));
  /* Lift off the bottom edge (dvh scales with dynamic viewport) */
  bottom: calc(2.5dvh + env(safe-area-inset-bottom, 0px));
  left: max(18px, env(safe-area-inset-left, 0px));
  z-index: 10;
  height: 96px;
  overflow: visible;
  pointer-events: none;
}

/*
 * Glass fill — masked with the SVG path so backdrop-filter follows the
 * dock silhouette. clip-path leaves blur rectangular in most engines.
 */
.nav-test-dock-surface {
  position: absolute;
  /* Symmetric bleed so both end caps + stroke AA have room */
  right: -3px;
  bottom: 9px;
  left: -3px;
  height: 93px;
  pointer-events: none;
  background: rgb(0 0 0 / 70%);
  backdrop-filter: blur(3px) brightness(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  /* Avoid filter/mask paint getting clipped to the border box */
  overflow: visible;
}

/*
 * White path stroke — shared rim base.
 * Position/size driven by debug vars on .nav-test-dock:
 *   --rim-left --rim-right --rim-bottom --rim-height
 * Per-layer transform/size/opacity via:
 *   --rim-x --rim-y --rim-layer-height --rim-scale --rim-opacity
 */
.nav-test-dock-rim {
  position: absolute;
  left: var(--rim-left, -3px);
  right: var(--rim-right, -3px);
  bottom: var(--rim-bottom, 13px);
  z-index: 1;
  /* Per-layer height wins; falls back to shared base height */
  height: var(--rim-layer-height, var(--rim-height, 87px));
  width: auto;
  overflow: visible;
  pointer-events: none;
  opacity: var(--rim-opacity, 1);
  transform: translate(var(--rim-x, 0px), var(--rim-y, 0px))
    scale(var(--rim-scale, 1));
  transform-origin: center center;
  -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 22%, transparent 58%);
  mask-image: linear-gradient(149deg, #000 8%, transparent 21%);
}

.nav-test-dock-rim path {
  fill: none;
  stroke: #fff;
  paint-order: stroke fill;
}

/* Soft outer glow layer */
.nav-test-dock-rim-a {
  filter: blur(1.5px);
  -webkit-mask-image: linear-gradient(166deg, #000 8%, transparent 41%);
  mask-image: linear-gradient(166deg, #000 8%, transparent 41%);
}

/* Crisp left edge (transform/height via debug vars / DEFAULT_RIM_DEBUG) */
.nav-test-dock-rim-c {
}

/* Bottom-right soft glow */
.nav-test-dock-rim-br-a {
  filter: blur(1.5px);
  -webkit-mask-image: linear-gradient(304deg, #000 0%, #000 4%, transparent 20%);
  mask-image: linear-gradient(304deg, #000 0%, #000 4%, transparent 20%);
}

/* Bottom-right crisp edge */
.nav-test-dock-rim-br-c {
  -webkit-mask-image: linear-gradient(355deg, #000 0%, #000 2%, transparent 12%);
  mask-image: linear-gradient(355deg, #000 0%, #000 2%, transparent 12%);
}

.nav-test-dock-items {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: end;
  height: 78px;
  padding: 0px 10px 18px;
  pointer-events: auto;
}

.nav-test-dock-item {
  display: grid;
  justify-items: center;
  align-content: end;
  gap: 8px;
  min-width: 0;
  height: 100%;
  padding: 0 2px 7px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  cursor: pointer;
  transition: color 160ms ease, transform 140ms ease;
}

.nav-test-dock-item.is-active {
  color: #ff8fb1;
}

.nav-test-dock-item:active {
  transform: scale(0.96);
}

.nav-test-dock-item:focus-visible {
  outline: 2px solid rgba(255, 143, 177, 0.9);
  outline-offset: 2px;
}

.nav-test-dock-icon {
  width: 21px;
  height: 21px;
}

.nav-test-dock-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.nav-test-dock-primary {
  position: relative;
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 6px;
}

/* Hero button — Collection icon + cutout glow (~10% larger) */
.nav-test-dock-primary-glow,
.nav-test-hero-btn {
  position: absolute;
  top: -14px;
  left: 50%;
  z-index: 5;
  width: 60px;
  height: 60px;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  transform: translate(-50%, -6px);
  transition: transform 160ms ease;
}

.nav-test-dock-primary-glow.border-glow-card {
  background: transparent !important;
}

.nav-test-dock-primary-glow .border-glow-inner {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  overflow: visible;
  background: transparent;
}

/*
 * Soft orbiting rim + circular center hole (glass shows through).
 * Hole driven by debug CSS vars:
 *   --cutout-x / --cutout-y / --cutout-size / --cutout-feather
 *   --cutout-edge-size / --cutout-edge-feather
 */
.nav-test-dock-primary-glow.border-glow-orbiting::before {
  -webkit-mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      #000 0%,
      #000 18%,
      transparent 42%,
      transparent 58%,
      #000 82%,
      #000 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      #000 0%,
      #000 18%,
      transparent 42%,
      transparent 58%,
      #000 82%,
      #000 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.nav-test-dock-primary-glow.border-glow-orbiting::after {
  -webkit-mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      transparent 0%,
      #000 10%,
      #000 30%,
      transparent 48%,
      transparent 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      transparent 0%,
      #000 10%,
      #000 30%,
      transparent 48%,
      transparent 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 62%),
      #000 var(--cutout-feather, 72%) 100%
    );
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

/* edge-light is padded outward — hole uses scaled vars */
.nav-test-dock-primary-glow.border-glow-orbiting > .edge-light {
  -webkit-mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      #000 0%,
      #000 10%,
      transparent 30%,
      transparent 70%,
      #000 90%,
      #000 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-edge-size, 39.06%),
      #000 var(--cutout-edge-feather, 45.36%) 100%
    );
  mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      #000 0%,
      #000 10%,
      transparent 30%,
      transparent 70%,
      #000 90%,
      #000 100%
    ),
    radial-gradient(
      circle at var(--cutout-x, 50.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-edge-size, 39.06%),
      #000 var(--cutout-edge-feather, 45.36%) 100%
    );
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.nav-test-dock-primary-btn {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #ff8fb1;
  cursor: pointer;
  transition: transform 160ms ease, color 180ms ease;
}

.nav-test-dock-primary.is-active .nav-test-dock-primary-btn {
  color: #ffb0c8;
}

.nav-test-dock-primary-glow:active {
  transform: translate(-50%, -6px) scale(0.97);
}

.nav-test-dock-primary-btn:focus-visible {
  outline: 2px solid rgba(255, 143, 177, 0.9);
  outline-offset: 3px;
}

.nav-test-dock-primary-icon {
  width: 28px;
  height: 28px;
  filter: drop-shadow(0 0 7px rgba(255, 86, 157, 0.35));
}

.nav-test-dock-primary-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.nav-test-dock-primary.is-active .nav-test-dock-primary-label {
  color: #ff8fb1;
}

/* ── Rim light debug panel ───────────────────────────────────── */
.nav-test-rim-debug {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 80;
  width: min(360px, calc(100vw - 20px));
  max-height: calc(100dvh - 20px);
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 16px;
  background: rgba(8, 8, 10, 0.92);
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  font-size: 13px;
}

.nav-test-rim-debug-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.nav-test-rim-debug-header strong {
  display: block;
  font-size: 14px;
  letter-spacing: 0.02em;
}

.nav-test-rim-debug-header span {
  display: block;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.nav-test-rim-debug-hide,
.nav-test-rim-debug-show,
.nav-test-rim-debug-actions button {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.nav-test-rim-debug-show {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 80;
}

.nav-test-rim-debug-section {
  margin: 14px 0 8px;
  color: rgba(255, 143, 177, 0.9);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.nav-test-rim-debug-row {
  display: grid;
  grid-template-columns: 72px 1fr 48px;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.nav-test-rim-debug-row span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.nav-test-rim-debug-row em {
  font-style: normal;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #ffb0c8;
  font-size: 12px;
}

/* Big slider track + thumb for touch / precision */
.nav-test-rim-debug-row input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  background: transparent;
  cursor: pointer;
}

.nav-test-rim-debug-row input[type="range"]::-webkit-slider-runnable-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.nav-test-rim-debug-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  margin-top: -9px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: #ff8fb1;
  box-shadow: 0 2px 10px rgba(255, 80, 145, 0.45);
}

.nav-test-rim-debug-row input[type="range"]::-moz-range-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.nav-test-rim-debug-row input[type="range"]::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: #ff8fb1;
  box-shadow: 0 2px 10px rgba(255, 80, 145, 0.45);
}

.nav-test-rim-debug-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.nav-test-rim-debug-tabs button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  padding: 10px 6px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.nav-test-rim-debug-tabs button.is-active {
  border-color: rgba(255, 143, 177, 0.55);
  background: rgba(255, 143, 177, 0.18);
  color: #fff;
}

.nav-test-rim-debug-layer-name {
  margin: 0 0 10px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.nav-test-rim-debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 8px;
}

.nav-test-rim-debug-actions button:hover,
.nav-test-rim-debug-hide:hover,
.nav-test-rim-debug-show:hover {
  background: rgba(255, 143, 177, 0.2);
  border-color: rgba(255, 143, 177, 0.45);
}

.nav-test-rim-debug-msg {
  margin: 0 0 8px;
  color: #9dffc0;
  font-size: 12px;
}

.nav-test-rim-debug-pre {
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 220, 235, 0.9);
  font-size: 10px;
  line-height: 1.4;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
}
`;
