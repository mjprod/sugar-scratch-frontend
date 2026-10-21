import type { ReactNode, Ref } from "react";
import { LpBuildDots } from "@/pages/lp-build/LpBuildDots";
import "./lp-build.css";

function MeshPair({ className }: { className: string }) {
  return (
    <div className={`lp-build-mesh ${className}`} aria-hidden="true">
      <span className="lp-build-mesh-orb lp-build-mesh-orb--a" />
      <span className="lp-build-mesh-orb lp-build-mesh-orb--b" />
    </div>
  );
}

export function LpBuildShell({
  children,
  showDots,
  dotsHigh,
  isDesktop,
  scrollerRef,
  activeIndex,
  onSelectDot,
  onPlayAgain,
}: {
  children?: ReactNode;
  showDots: boolean;
  dotsHigh: boolean;
  isDesktop: boolean;
  scrollerRef?: Ref<HTMLElement>;
  activeIndex: number;
  onSelectDot: (index: number) => void;
  onPlayAgain: () => void;
}) {
  const className = [
    "lp-build-shell",
    isDesktop ? "lp-build-shell--desktop" : "lp-build-shell--mobile",
    dotsHigh ? "lp-build-shell--dots-high" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main ref={scrollerRef} className={className}>
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
        <button
          type="button"
          className="lp-build-play-again glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-80 glass-surface"
          onClick={onPlayAgain}
        >
          Replay Demo
        </button>
      </header>
      {children}
      {showDots ? (
        <LpBuildDots activeIndex={activeIndex} onSelect={onSelectDot} />
      ) : null}
    </main>
  );
}
