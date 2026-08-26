/** Explicit demo fixtures. Never auto-enable from a dead API. */
export function isDemoMode(): boolean {
  try {
    if (typeof process !== "undefined" && process.env.SUGAR_DEMO === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}
