import { useState } from "react";
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

export function NavTestPage() {
  const [active, setActive] = useState<NavTestTab>("home");

  return (
    <section className="nav-test">
      <style>{NAV_TEST_CSS}</style>

      <div
        className="nav-test-cover"
        style={{ backgroundImage: `url(${COVER_IMAGE})` }}
        role="img"
        aria-label={`${active} cover background`}
      />

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

        {/* Rim light sets — narrow 2px stroke strips at left / center / right */}
        <div className="nav-test-dock-rims" aria-hidden="true">
          <div className="top-left-rim-light">
            <div className="rim-left-a" />
            <div className="rim-left-a-b" />
          </div>

          <div className="middle-right-rim-light">
            <div className="rim-center-a" />
            <div className="rim-center-a-b" />
          </div>

          <div className="bottom-right-rim-light">
            <div className="rim-right-a" />
            <div className="rim-right-a-b" />
          </div>
        </div>

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

/* ── Rim light sets (left / center / right strips) ──────────────── */
.nav-test-dock-rims {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  overflow: visible;
}

.top-left-rim-light,
.middle-right-rim-light,
.bottom-right-rim-light {
  position: relative;
  flex: 0 0 auto;
  width: 10dvw;
  height: 96px;
  overflow: visible;
  pointer-events: none;
}

.top-left-rim-light {
  transform-origin: top left;
  height: 75%;
}

.middle-right-rim-light {
  transform-origin: top center;
  width: 65px;
  height: 66px;
  align-self: flex-start;
  transform: translate(0%, -8%);
}

.bottom-right-rim-light {
  transform-origin: top right;
  height: 75%;
}

.rim-left-a,
.rim-left-a-b,
.rim-center-a,
.rim-center-a-b,
.rim-right-a,
.rim-right-a-b {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 10dvw;
  height: 96px;
  border: 2px solid #fff;
  background: transparent;
  pointer-events: none;
}

.rim-left-a,
.rim-left-a-b {
  transform-origin: top left;
  border-radius: 20rem 0 0 20rem;
  width: 30dvw;
  height: 100%;
}

.rim-center-a,
.rim-center-a-b {
  transform-origin: top center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid #fff;
}

.rim-right-a,
.rim-right-a-b {
  transform-origin: top right;
  border-radius: 0 20rem 20rem 0;
  width: 30dvw;
  height: 100%;
  right: 0;
  left: auto;
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
`;
