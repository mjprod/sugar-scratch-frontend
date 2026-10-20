import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { LpBuildDots } from "@/pages/lp-build/LpBuildDots";
import { Paths } from "@/routes/Paths";
import "./lp-build.css";

function MeshPair({ className }: { className: string }) {
  return (
    <div className={`lp-build-mesh ${className}`} aria-hidden="true">
      <span className="lp-build-mesh-orb lp-build-mesh-orb--a" />
      <span className="lp-build-mesh-orb lp-build-mesh-orb--b" />
    </div>
  );
}

export function LpBuildShell({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const dotsHigh =
    pathname === Paths.lpBuildPage4 || pathname === Paths.lpBuildPage5;
  const showDots = pathname !== Paths.lpBuildPage6;

  return (
    <main
      className={dotsHigh ? "lp-build-shell lp-build-shell--dots-high" : "lp-build-shell"}
    >
      <div className="lp-build-mesh-layer" aria-hidden="true">
        <MeshPair className="lp-build-mesh--top-right" />
        <MeshPair className="lp-build-mesh--bottom-left" />
      </div>
      <header className="lp-build-header">
        <img
          src="/svg/logoSugarScratch.svg"
          alt="Sugar Scratch"
          className="lp-build-logo"
          draggable={false}
        />
      </header>
      {children}
      {showDots ? <LpBuildDots /> : null}
    </main>
  );
}
