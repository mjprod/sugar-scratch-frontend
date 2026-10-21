const LP_DOTS = [
  { label: "Hero" },
  { label: "Benefits" },
  { label: "Calculator" },
  { label: "Join" },
] as const;

export function LpBuildDots({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      className="lp-build-dots glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-80 glass-surface"
      aria-label="Landing pages"
    >
      {LP_DOTS.map((dot, index) => (
        <button
          key={dot.label}
          type="button"
          className={index === activeIndex ? "lp-build-dot is-active" : "lp-build-dot"}
          aria-label={dot.label}
          aria-current={index === activeIndex ? "true" : undefined}
          onClick={() => onSelect(index)}
        />
      ))}
    </nav>
  );
}
