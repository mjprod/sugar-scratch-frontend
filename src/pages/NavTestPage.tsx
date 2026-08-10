import { useMemo, useState } from "react";
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

const DOCK_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512.2 106.5" preserveAspectRatio="none"><path fill="white" d="${DOCK_PATH}"/></svg>`,
)}")`;

const COVER_IMAGE =
  "https://fastly.picsum.photos/id/1043/200/200.jpg?hmac=i7xbST4bM6KMg5XsUaVYvDgwvsZ3VskoXKRqGf1BjcU";

/** Exactly 3 mesh colors for Collection BorderGlow rim */
const COLLECTION_GLOW_COLORS = ["#ff8fb1", "#f472b6", "#c084fc"] as const;

type CutoutDebug = {
  /** Hole center X as % of glow box */
  offsetX: number;
  /** Hole center Y as % of glow box */
  offsetY: number;
  /** Transparent hole radius as % of glow box */
  size: number;
  /** Soft edge after size (solid glow starts here), as % */
  feather: number;
  /** edge-light layer is larger — scale hole % relative to that layer */
  edgeScale: number;
};

const DEFAULT_CUTOUT: CutoutDebug = {
  offsetX: 51.5,
  offsetY: 52,
  size: 64.5,
  feather: 72,
  edgeScale: 0.49,
};

function buildCutoutCss(c: CutoutDebug) {
  const solid = Math.max(c.size, Math.min(c.feather, 99));
  const edgeSize = Math.max(1, Math.min(90, c.size * c.edgeScale));
  const edgeSolid = Math.max(edgeSize + 1, Math.min(95, solid * c.edgeScale));
  const pos = `${c.offsetX}% ${c.offsetY}%`;

  return {
    json: {
      offsetX: c.offsetX,
      offsetY: c.offsetY,
      size: c.size,
      feather: solid,
      edgeScale: c.edgeScale,
      edgeSize: Number(edgeSize.toFixed(2)),
      edgeFeather: Number(edgeSolid.toFixed(2)),
      position: pos,
      radialSurface: `radial-gradient(circle at ${pos}, transparent 0 ${c.size}%, #000 ${solid}% 100%)`,
      radialEdge: `radial-gradient(circle at ${pos}, transparent 0 ${edgeSize.toFixed(2)}%, #000 ${edgeSolid.toFixed(2)}% 100%)`,
    },
    css: `/* Collection glow center cutout */
--cutout-x: ${c.offsetX}%;
--cutout-y: ${c.offsetY}%;
--cutout-size: ${c.size}%;
--cutout-feather: ${solid}%;
--cutout-edge-size: ${edgeSize.toFixed(2)}%;
--cutout-edge-feather: ${edgeSolid.toFixed(2)}%;

/* surface / ::before / ::after hole */
radial-gradient(
  circle at ${pos},
  transparent 0 ${c.size}%,
  #000 ${solid}% 100%
)

/* .edge-light hole (scaled) */
radial-gradient(
  circle at ${pos},
  transparent 0 ${edgeSize.toFixed(2)}%,
  #000 ${edgeSolid.toFixed(2)}% 100%
)`,
  };
}

export function NavTestPage() {
  const [active, setActive] = useState<NavTestTab>("home");
  const [cutout, setCutout] = useState<CutoutDebug>(DEFAULT_CUTOUT);
  const [copyMsg, setCopyMsg] = useState("");
  const [showGuide, setShowGuide] = useState(true);

  const cutoutExport = useMemo(() => buildCutoutCss(cutout), [cutout]);

  const cutoutStyle = {
    ["--cutout-x" as string]: `${cutout.offsetX}%`,
    ["--cutout-y" as string]: `${cutout.offsetY}%`,
    ["--cutout-size" as string]: `${cutout.size}%`,
    ["--cutout-feather" as string]: `${Math.max(cutout.size, cutout.feather)}%`,
    ["--cutout-edge-size" as string]: `${Math.max(1, cutout.size * cutout.edgeScale)}%`,
    ["--cutout-edge-feather" as string]: `${Math.max(
      cutout.size * cutout.edgeScale + 1,
      Math.max(cutout.size, cutout.feather) * cutout.edgeScale,
    )}%`,
  };

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`Copied ${label}`);
    } catch {
      setCopyMsg("Copy failed — select the text manually");
    }
    window.setTimeout(() => setCopyMsg(""), 1600);
  }

  function setField<K extends keyof CutoutDebug>(key: K, value: number) {
    setCutout((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section className="nav-test">
      <style>{NAV_TEST_CSS}</style>

      <div
        className="nav-test-cover"
        style={{ backgroundImage: `url(${COVER_IMAGE})` }}
        role="img"
        aria-label={`${active} cover background`}
      />

      <aside className="nav-test-debug" aria-label="Cutout debug controls">
        <header className="nav-test-debug-header">
          <strong>Cutout debug</strong>
          <span>offset + size %</span>
        </header>

        <label className="nav-test-debug-row">
          <span>Offset X %</span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={cutout.offsetX}
            onChange={(e) => setField("offsetX", Number(e.target.value))}
          />
          <em>{cutout.offsetX}</em>
        </label>

        <label className="nav-test-debug-row">
          <span>Offset Y %</span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={cutout.offsetY}
            onChange={(e) => setField("offsetY", Number(e.target.value))}
          />
          <em>{cutout.offsetY}</em>
        </label>

        <label className="nav-test-debug-row">
          <span>Circle size %</span>
          <input
            type="range"
            min={5}
            max={90}
            step={0.5}
            value={cutout.size}
            onChange={(e) => setField("size", Number(e.target.value))}
          />
          <em>{cutout.size}</em>
        </label>

        <label className="nav-test-debug-row">
          <span>Feather %</span>
          <input
            type="range"
            min={6}
            max={95}
            step={0.5}
            value={cutout.feather}
            onChange={(e) => setField("feather", Number(e.target.value))}
          />
          <em>{Math.max(cutout.size, cutout.feather)}</em>
        </label>

        <label className="nav-test-debug-row">
          <span>Edge scale</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={cutout.edgeScale}
            onChange={(e) => setField("edgeScale", Number(e.target.value))}
          />
          <em>{cutout.edgeScale.toFixed(2)}</em>
        </label>

        <label className="nav-test-debug-check">
          <input
            type="checkbox"
            checked={showGuide}
            onChange={(e) => setShowGuide(e.target.checked)}
          />
          Show cutout guide
        </label>

        <div className="nav-test-debug-actions">
          <button
            type="button"
            onClick={() =>
              copyText("JSON", JSON.stringify(cutoutExport.json, null, 2))
            }
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={() => copyText("CSS", cutoutExport.css)}
          >
            Copy CSS
          </button>
          <button type="button" onClick={() => setCutout(DEFAULT_CUTOUT)}>
            Reset
          </button>
        </div>

        {copyMsg ? <p className="nav-test-debug-msg">{copyMsg}</p> : null}

        <pre className="nav-test-debug-pre">{JSON.stringify(cutoutExport.json, null, 2)}</pre>
      </aside>

      <nav className="nav-test-dock" aria-label="Experimental bottom navigation">
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
          Three layers so you can offset each for a realistic rim light.
        */}
        <svg
          className="nav-test-dock-rim nav-test-dock-rim-a"
          viewBox="0 0 512.2 106.5"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={DOCK_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <svg
          className="nav-test-dock-rim nav-test-dock-rim-c"
          viewBox="0 0 512.2 106.5"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={DOCK_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
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
                    className="nav-test-dock-primary-glow border-glow-always-on"
                    borderRadius={999}
                    backgroundColor="transparent"
                    glowColor="330 90 78"
                    glowRadius={18}
                    glowIntensity={1.05}
                    coneSpread={28}
                    edgeSensitivity={0}
                    fillOpacity={0.2}
                    animated={false}
                    orbit
                    orbitDuration={7}
                    colors={[...COLLECTION_GLOW_COLORS]}
                    style={cutoutStyle}
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
                    {showGuide ? (
                      <span className="nav-test-cutout-guide" aria-hidden="true" />
                    ) : null}
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
  overflow: hidden;
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
  right: 14px;
  /* Lift off the bottom edge (dvh scales with dynamic viewport) */
  bottom: calc(2.5dvh + env(safe-area-inset-bottom, 0px));
  left: 14px;
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
  right: 0;
  bottom: 9px;
  left: 0;
  height: 85px;
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
}

/* White path stroke — shared rim base (offset each layer below) */
.nav-test-dock-rim {
  position: absolute;
  right: 0;
  bottom: 9px;
  left: 0;
  z-index: 1;
  height: 85px;
  width: 100%;
  overflow: visible;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 22%, transparent 58%);
  mask-image: linear-gradient(149deg, #000 8%, transparent 21%);
  /* filter: blur(1px); */
  opacity: 1;
}

.nav-test-dock-rim path {
  fill: none;
  stroke: #fff;
}

/* Offset these independently for layered rim light */
.nav-test-dock-rim-a {
  left: 2px;
  opacity: 1;
  filter: blur(2px);
  -webkit-mask-image: linear-gradient(166deg, #000 38%, transparent 51%);
  mask-image: linear-gradient(166deg, #000 38%, transparent 51%);
}

.nav-test-dock-rim-c {
  /* e.g. transform: translate(-1px, 0); opacity: 0.3; */
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

/* BorderGlow wrapper = Collection icon parent with permanent rim glow */
.nav-test-dock-primary-glow {
  position: absolute;
  top: -11px;
  left: 50%;
  z-index: 2;
  width: 52px;
  height: 52px;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  transform: translateX(-50%);
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
      circle at var(--cutout-x, 51.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 64.5%),
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
      circle at var(--cutout-x, 51.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 64.5%),
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
      circle at var(--cutout-x, 51.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 64.5%),
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
      circle at var(--cutout-x, 51.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-size, 64.5%),
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
      circle at var(--cutout-x, 51.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-edge-size, 31.61%),
      #000 var(--cutout-edge-feather, 35.28%) 100%
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
      circle at var(--cutout-x, 51.5%) var(--cutout-y, 52%),
      transparent 0 var(--cutout-edge-size, 31.61%),
      #000 var(--cutout-edge-feather, 35.28%) 100%
    );
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

/* Visual guide for the cutout circle (debug only) */
.nav-test-cutout-guide {
  position: absolute;
  left: var(--cutout-x, 51.5%);
  top: var(--cutout-y, 52%);
  z-index: 5;
  width: calc(var(--cutout-size, 64.5%) * 2);
  height: calc(var(--cutout-size, 64.5%) * 2);
  border: 1px dashed rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.nav-test-cutout-guide::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
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
  transform: translateX(-50%) scale(0.97);
}

.nav-test-dock-primary-btn:focus-visible {
  outline: 2px solid rgba(255, 143, 177, 0.9);
  outline-offset: 3px;
}

.nav-test-dock-primary-icon {
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 0 6px rgba(255, 86, 157, 0.35));
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

/* ── Cutout debug panel ───────────────────────────────────────── */
.nav-test-debug {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 50;
  width: min(320px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  overflow: auto;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  background: rgba(8, 8, 10, 0.88);
  color: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  font-size: 12px;
}

.nav-test-debug-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.nav-test-debug-header strong {
  font-size: 13px;
  letter-spacing: 0.02em;
}

.nav-test-debug-header span {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.nav-test-debug-row {
  display: grid;
  grid-template-columns: 88px 1fr 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.nav-test-debug-row span {
  color: rgba(255, 255, 255, 0.7);
}

.nav-test-debug-row em {
  font-style: normal;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #ffb0c8;
}

.nav-test-debug-row input[type="range"] {
  width: 100%;
  accent-color: #ff8fb1;
}

.nav-test-debug-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 10px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.nav-test-debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.nav-test-debug-actions button {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 6px 10px;
  font-size: 11px;
  cursor: pointer;
}

.nav-test-debug-actions button:hover {
  background: rgba(255, 143, 177, 0.18);
  border-color: rgba(255, 143, 177, 0.4);
}

.nav-test-debug-msg {
  margin: 0 0 8px;
  color: #9dffc0;
  font-size: 11px;
}

.nav-test-debug-pre {
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 220, 235, 0.9);
  font-size: 10px;
  line-height: 1.4;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
`;
