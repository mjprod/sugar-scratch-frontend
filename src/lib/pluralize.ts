/** `card` / `cards` — count 1 stays singular. */
export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return Math.abs(count) === 1 ? singular : plural;
}
