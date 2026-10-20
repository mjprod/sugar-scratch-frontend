import { NavLink } from "react-router-dom";
import { Paths } from "@/routes/Paths";

const LP_DOTS = [
  { to: Paths.lpBuildPage2, label: "Page 2" },
  { to: Paths.lpBuildPage3, label: "Page 3" },
  { to: Paths.lpBuildPage4, label: "Page 4" },
  { to: Paths.lpBuildPage5, label: "Page 5" },
] as const;

export function LpBuildDots() {
  return (
    <nav
      className="lp-build-dots glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-80 glass-surface"
      aria-label="Landing pages"
    >
      {LP_DOTS.map((dot) => (
        <NavLink
          key={dot.to}
          to={dot.to}
          className={({ isActive }) =>
            isActive ? "lp-build-dot is-active" : "lp-build-dot"
          }
          aria-label={dot.label}
        />
      ))}
    </nav>
  );
}
