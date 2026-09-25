/** AC12/AC13 — HUD balance text: "0", "--", or en-US thousands (e.g. "5,133"). */
export function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US");
}

/**
 * Compact balance for tight UI (wallet popover Dust, etc.).
 * 17,907 → "17.9K"; 17,907,907 → "17.9M"; 1_790_000_000 → "1.8B".
 */
export function formatCompactBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  const n = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (n < 1000) return `${sign}${Math.round(n).toLocaleString("en-US")}`;

  const tiers = [
    { div: 1_000_000_000, suffix: "B" },
    { div: 1_000_000, suffix: "M" },
    { div: 1_000, suffix: "K" },
  ] as const;

  for (const tier of tiers) {
    if (n >= tier.div) {
      const scaled = n / tier.div;
      const rounded =
        scaled >= 100
          ? Math.round(scaled).toString()
          : scaled.toFixed(1).replace(/\.0$/, "");
      return `${sign}${rounded}${tier.suffix}`;
    }
  }

  return `${sign}${Math.round(n).toLocaleString("en-US")}`;
}
