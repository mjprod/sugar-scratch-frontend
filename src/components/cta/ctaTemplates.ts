/**
 * Named CTA presets for the button-test lab.
 * Add a new entry here when starting work on the next button style.
 */

import type { CtaButtonProps, CtaShape } from "./CtaButton";

export type CtaTemplateId =
  | "squircleCTA"
  | "hexGoldCTA"
  | "pillGoldCTA"
  | "pillBlackCTA"
  | "pillPurpleCTA";

export type CtaTemplateValues = {
  label: string;
  /** Empty string hides the cost row. */
  costAmount: string;
  costIcon: string;
  shape: CtaShape;
  width: number;
  height: number;
  cornerRadius: number;
  /** Hex tip depth as a fraction of height. */
  hexTip: number;
  strokeWidth: number;
  strokeColor: string;
  auroraA: string;
  auroraB: string;
  /** Extra stop between B and C. */
  auroraMid: string;
  auroraC: string;
  auroraSpeed: number;
  auroraBlend: number;
  auroraAmplitude: number;
  auroraBandHeight: number;
  auroraRotation: number;
  auroraBaseColor: string;
  particleCount: number;
  particleSize: number;
  particleSpeed: number;
  particleOpacity: number;
  particleColor: string;
  particleTwinkle: number;
  labelColor: string;
  fontSize: number;
  glowEnabled: boolean;
  glowAlwaysOn: boolean;
  glowEdgeSensitivity: number;
  glowColor: string;
  glowRadius: number;
  glowIntensity: number;
  glowConeSpread: number;
  glowFillOpacity: number;
  glowOrbitSpeed: number;
  glowAlwaysOnProximity: number;
  glowA: string;
  glowB: string;
  glowC: string;
};

export type CtaTemplate = {
  id: CtaTemplateId;
  name: string;
  description: string;
  values: CtaTemplateValues;
};

/** Soft rounded rect + aurora face + always-on border glow. */
export const SQUIRCLE_CTA: CtaTemplate = {
  id: "squircleCTA",
  name: "Squircle CTA",
  description: "Soft rounded rect with aurora fill and orbiting border glow.",
  values: {
    label: "Start Playing",
    costAmount: "",
    /** Marker — CtaButton maps this to the static diamond mark. */
    costIcon: "💎",
    shape: "squircle",
    width: 292,
    height: 64,
    /* Large enough to clamp to half-height → full pill silhouette. */
    cornerRadius: 999,
    hexTip: 0.27,
    strokeWidth: 1,
    /* Soft magenta frost base; orbit cone paints mesh hues on top. */
    strokeColor: "rgba(170, 8, 95, 0.42)",
    auroraA: "#aa3c6b",
    auroraB: "#ea2e89",
    auroraMid: "#42001b",
    auroraC: "#933e4c",
    auroraSpeed: 1.2,
    auroraBlend: 1,
    auroraAmplitude: 1.1,
    auroraBandHeight: 2.2,
    auroraRotation: 2,
    auroraBaseColor: "#42001b",
    particleCount: 15,
    particleSize: 0.036,
    particleSpeed: 4,
    particleOpacity: 0.37,
    particleColor: "#fb4b97",
    particleTwinkle: 0.51,
    labelColor: "#ffe0e8",
    fontSize: 18,
    glowEnabled: true,
    glowAlwaysOn: true,
    glowEdgeSensitivity: 15,
    glowColor: "326 90 30",
    glowRadius: 40,
    glowIntensity: 0.95,
    glowConeSpread: 28,
    glowFillOpacity: 0.13,
    glowOrbitSpeed: 70,
    glowAlwaysOnProximity: 94,
    glowA: "#aa085f",
    glowB: "#e00083",
    glowC: "#eb6a00",
  },
};

/** Pointed hex badge + gold aurora — Open Pack style. */
export const HEX_GOLD_CTA: CtaTemplate = {
  id: "hexGoldCTA",
  name: "Hex Gold CTA",
  description: "Pointed hexagon badge with gold aurora fill, cost row, and warm border glow.",
  values: {
    label: "OPEN PACK",
    costAmount: "10",
    costIcon: "💎",
    shape: "hex",
    width: 280,
    height: 95,
    cornerRadius: 0,
    hexTip: 0.27,
    strokeWidth: 3,
    strokeColor: "rgba(255, 236, 180, 0.55)",
    auroraA: "#ffd080",
    auroraB: "#3d2808",
    auroraMid: "#3d2808",
    auroraC: "#ffbc70",
    auroraSpeed: 0.95,
    auroraBlend: 0.58,
    auroraAmplitude: 0.8,
    auroraBandHeight: 1.4,
    auroraRotation: 16,
    auroraBaseColor: "#3d2808",
    particleCount: 10,
    particleSize: 0.025,
    particleSpeed: 2.95,
    particleOpacity: 0.48,
    particleColor: "#fff1c2",
    particleTwinkle: 0.62,
    labelColor: "#fff8e6",
    fontSize: 17,
    glowEnabled: true,
    glowAlwaysOn: true,
    glowEdgeSensitivity: 51,
    glowColor: "42 95 58",
    glowRadius: 24,
    glowIntensity: 0.9,
    glowConeSpread: 28,
    glowFillOpacity: 0,
    glowOrbitSpeed: 74,
    glowAlwaysOnProximity: 92,
    glowA: "#d37217",
    glowB: "#ff9c66",
    glowC: "#ff9f1a",
  },
};

/** Soft pill silhouette + gold aurora — Claim Reward style. */
export const PILL_GOLD_CTA: CtaTemplate = {
  id: "pillGoldCTA",
  name: "Pill Gold CTA",
  description: "Soft pill silhouette with gold aurora fill and warm border glow.",
  values: {
    label: "Claim Reward",
    costAmount: "",
    costIcon: "💎",
    shape: "squircle",
    width: 292,
    height: 64,
    cornerRadius: 999,
    hexTip: 0.27,
    strokeWidth: 1,
    strokeColor: "rgba(255, 236, 180, 0.55)",
    auroraA: "#ffd080",
    auroraB: "#3d2808",
    auroraMid: "#3d2808",
    auroraC: "#ffbc70",
    auroraSpeed: 0.95,
    auroraBlend: 0.58,
    auroraAmplitude: 0.8,
    auroraBandHeight: 1.4,
    auroraRotation: 16,
    auroraBaseColor: "#3d2808",
    particleCount: 10,
    particleSize: 0.025,
    particleSpeed: 2.95,
    particleOpacity: 0.48,
    particleColor: "#fff1c2",
    particleTwinkle: 0.62,
    labelColor: "#fff8e6",
    fontSize: 18,
    glowEnabled: true,
    glowAlwaysOn: true,
    glowEdgeSensitivity: 51,
    glowColor: "42 95 58",
    glowRadius: 24,
    glowIntensity: 0.9,
    glowConeSpread: 28,
    glowFillOpacity: 0,
    glowOrbitSpeed: 74,
    glowAlwaysOnProximity: 92,
    glowA: "#d37217",
    glowB: "#ff9c66",
    glowC: "#ff9f1a",
  },
};

/** Soft pill + black aurora — Claim Reward style. */
export const PILL_BLACK_CTA: CtaTemplate = {
  id: "pillBlackCTA",
  name: "Pill Black CTA",
  description:
    "Soft pill silhouette with a cool-neutral aurora — same shade curve as Notify Me purple.",
  values: {
    label: "Claim Reward",
    costAmount: "",
    costIcon: "💎",
    shape: "squircle",
    width: 292,
    height: 64,
    cornerRadius: 999,
    hexTip: 0.27,
    strokeWidth: 1,
    /*
      Same lightness curve as pillPurpleCTA (L ≈ 0.16–0.62), cool-neutral.
      Hex so WebGL (ogl Color) + CSS fallback both pick up the shade.
    */
    strokeColor: "rgba(182, 186, 195, 0.42)",
    auroraA: "#8b9099",
    auroraB: "#34373d",
    auroraMid: "#22252a",
    auroraC: "#6d717a",
    auroraSpeed: 0.95,
    auroraBlend: 0.5,
    auroraAmplitude: 0.7,
    auroraBandHeight: 1.3,
    auroraRotation: 16,
    auroraBaseColor: "#1d1f24",
    particleCount: 12,
    particleSize: 0.022,
    particleSpeed: 2.6,
    particleOpacity: 0.48,
    particleColor: "#dfe2e8",
    particleTwinkle: 0.55,
    labelColor: "#eceef2",
    fontSize: 18,
    glowEnabled: true,
    glowAlwaysOn: true,
    glowEdgeSensitivity: 42,
    glowColor: "250 6 42",
    glowRadius: 24,
    glowIntensity: 0.58,
    glowConeSpread: 28,
    glowFillOpacity: 0,
    glowOrbitSpeed: 62,
    glowAlwaysOnProximity: 92,
    glowA: "#b6bac3",
    glowB: "#8b9099",
    glowC: "#686d76",
  },
};

/** Soft pill + purple aurora — Notify Me style. */
export const PILL_PURPLE_CTA: CtaTemplate = {
  id: "pillPurpleCTA",
  name: "Pill Purple CTA",
  description: "Soft pill silhouette with a 301.3 hue aurora fill and matching border glow.",
  values: {
    label: "Notify Me",
    costAmount: "",
    costIcon: "💎",
    shape: "squircle",
    width: 292,
    height: 64,
    cornerRadius: 999,
    hexTip: 0.27,
    strokeWidth: 1,
    strokeColor: "oklch(0.78 0.04 301.3 / 0.42)",
    auroraA: "oklch(0.62 0.05 301.3)",
    auroraB: "oklch(0.26 0.03 301.3)",
    auroraMid: "oklch(0.18 0.025 301.3)",
    auroraC: "oklch(0.5 0.04 301.3)",
    auroraSpeed: 0.95,
    auroraBlend: 0.5,
    auroraAmplitude: 0.7,
    auroraBandHeight: 1.3,
    auroraRotation: 16,
    auroraBaseColor: "oklch(0.16 0.02 301.3)",
    particleCount: 12,
    particleSize: 0.022,
    particleSpeed: 2.6,
    particleOpacity: 0.48,
    particleColor: "oklch(0.9 0.02 301.3)",
    particleTwinkle: 0.55,
    labelColor: "oklch(0.94 0.015 301.3)",
    fontSize: 18,
    glowEnabled: true,
    glowAlwaysOn: true,
    glowEdgeSensitivity: 42,
    glowColor: "301.3 18 52",
    glowRadius: 24,
    glowIntensity: 0.58,
    glowConeSpread: 28,
    glowFillOpacity: 0,
    glowOrbitSpeed: 62,
    glowAlwaysOnProximity: 92,
    glowA: "oklch(0.78 0.045 301.3)",
    glowB: "oklch(0.62 0.05 301.3)",
    glowC: "oklch(0.48 0.035 301.3)",
  },
};

export const CTA_TEMPLATES: readonly CtaTemplate[] = [
  SQUIRCLE_CTA,
  HEX_GOLD_CTA,
  PILL_GOLD_CTA,
  PILL_BLACK_CTA,
  PILL_PURPLE_CTA,
];

export const DEFAULT_CTA_TEMPLATE_ID: CtaTemplateId = "squircleCTA";

export function getCtaTemplate(id: CtaTemplateId): CtaTemplate {
  const found = CTA_TEMPLATES.find((t) => t.id === id);
  if (!found) return SQUIRCLE_CTA;
  return found;
}

export function cloneTemplateValues(id: CtaTemplateId): CtaTemplateValues {
  return { ...getCtaTemplate(id).values };
}

/** Map a template preset onto CtaButton props (label/cost still overridable). */
export function ctaButtonPropsFromTemplate(
  id: CtaTemplateId,
): Omit<
  CtaButtonProps,
  | "label"
  | "costAmount"
  | "costIcon"
  | "className"
  | "onClick"
  | "disabled"
  | "type"
  | "style"
> &
  Pick<CtaButtonProps, "label" | "costAmount" | "costIcon"> {
  const v = getCtaTemplate(id).values;
  return {
    label: v.label,
    costAmount: v.costAmount || null,
    costIcon: v.costIcon,
    shape: v.shape,
    width: v.width,
    height: v.height,
    cornerRadius: v.cornerRadius,
    hexTip: v.hexTip,
    strokeWidth: v.strokeWidth,
    strokeColor: v.strokeColor,
    auroraColorStops: [v.auroraA, v.auroraB, v.auroraMid, v.auroraC],
    auroraSpeed: v.auroraSpeed,
    auroraBlend: v.auroraBlend,
    auroraAmplitude: v.auroraAmplitude,
    auroraBandHeight: v.auroraBandHeight,
    auroraRotation: v.auroraRotation,
    auroraBaseColor: v.auroraBaseColor,
    particleCount: v.particleCount,
    particleSize: v.particleSize,
    particleSpeed: v.particleSpeed,
    particleOpacity: v.particleOpacity,
    particleColor: v.particleColor,
    particleTwinkle: v.particleTwinkle,
    labelColor: v.labelColor,
    fontSize: v.fontSize,
    glowEnabled: v.glowEnabled,
    glowAlwaysOn: v.glowAlwaysOn,
    glowEdgeSensitivity: v.glowEdgeSensitivity,
    glowColor: v.glowColor,
    glowRadius: v.glowRadius,
    glowIntensity: v.glowIntensity,
    glowConeSpread: v.glowConeSpread,
    glowFillOpacity: v.glowFillOpacity,
    glowOrbitSpeed: v.glowOrbitSpeed,
    glowAlwaysOnProximity: v.glowAlwaysOnProximity,
    glowColors: [v.glowA, v.glowB, v.glowC],
  };
}
