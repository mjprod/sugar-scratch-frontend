import { useState } from "react";
import { LiquidGlassNav } from "@/components/LiquidGlassNav";
import type { AppTab } from "@/types/app";
import "@/components/LiquidGlassNav.css";

/** Standalone playground for the liquid-glass nav chrome. */
export function NavTestPage() {
  const [active, setActive] = useState<AppTab>("home");

  return (
    <section className="nav-test is-playground">
      <div className="nav-test-playground-label" aria-live="polite">
        Active: {active}
      </div>
      <LiquidGlassNav activeTab={active} onTabChange={setActive} />
    </section>
  );
}
