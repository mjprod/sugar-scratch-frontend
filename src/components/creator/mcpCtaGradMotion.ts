/**
 * Map device tilt → CSS CTA rim gradient angle.
 * Rest pose matches the CSS orbit start (45deg).
 */
export function mcpCtaGradAngleFromMotion(
  gamma: number,
  beta: number,
): number {
  // Same ranges as HoloCard / coverflow device tilt.
  const yaw = Math.max(-1, Math.min(1, gamma / 42));
  const pitch = Math.max(-1, Math.min(1, (beta - 55) / 28));
  return 45 - yaw * 90 - pitch * 25;
}
