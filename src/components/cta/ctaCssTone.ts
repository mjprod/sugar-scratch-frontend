export type CssCtaTone = "default" | "gold" | "purple" | "black" | "red";

/** Map WebGL palette props onto the CSS plate color variants. */
export function resolveCssCtaTone(
  glowColors: readonly string[],
  auroraBaseColor: string,
): CssCtaTone {
  const sample = `${glowColors.join(" ")} ${auroraBaseColor}`.toLowerCase();
  if (
    sample.includes("d37217") ||
    sample.includes("ff9c66") ||
    sample.includes("ff9f1a") ||
    sample.includes("3d2808")
  ) {
    return "gold";
  }
  if (
    sample.includes("b6bac3") ||
    sample.includes("8b9099") ||
    sample.includes("1d1f24")
  ) {
    return "black";
  }
  if (
    sample.includes("8d00aa") ||
    sample.includes("d503ff") ||
    sample.includes("b44bff") ||
    sample.includes("1b0042") ||
    sample.includes("301.3")
  ) {
    return "purple";
  }
  return "default";
}
