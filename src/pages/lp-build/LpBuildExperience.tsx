import { useCallback, useEffect, useRef, useState } from "react";
import { LpBuildBenefits } from "@/pages/lp-build/LpBuildBenefits";
import { LpBuildCalculator } from "@/pages/lp-build/LpBuildCalculator";
import { LpBuildHero } from "@/pages/lp-build/LpBuildHero";
import { LpBuildJoin } from "@/pages/lp-build/LpBuildJoin";
import { LpBuildScratch } from "@/pages/lp-build/LpBuildScratch";
import { LpBuildShell } from "@/pages/lp-build/LpBuildShell";

const DESKTOP_MQ = "(min-width: 769px)";

const SECTION_IDS = [
  "lp-hero",
  "lp-benefits",
  "lp-calculator",
  "lp-join",
] as const;

const SLIDE_COUNT = SECTION_IDS.length;

export function LpBuildExperience() {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const programmaticScroll = useRef(false);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_MQ).matches : false,
  );
  const [scratchDone, setScratchDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hintOpacity, setHintOpacity] = useState(1);
  const [parallax, setParallax] = useState(0);
  const [benefitsParallax, setBenefitsParallax] = useState(0);
  const [benefitsEnter, setBenefitsEnter] = useState(1);
  const [calculatorParallax, setCalculatorParallax] = useState(0);
  const [joinProgress, setJoinProgress] = useState(0);

  const active = Math.max(0, Math.min(index, SLIDE_COUNT - 1));

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (submitted) return;
      const clamped = Math.max(0, Math.min(next, SLIDE_COUNT - 1));
      setIndex(clamped);
      const el = document.getElementById(SECTION_IDS[clamped]);
      if (!el) return;
      programmaticScroll.current = true;
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      window.setTimeout(() => {
        programmaticScroll.current = false;
      }, reduceMotion ? 50 : 700);
    },
    [reduceMotion, submitted],
  );

  useEffect(() => {
    if (!scratchDone) return;
    const root = scrollerRef.current;
    if (!root) return;
    const onScroll = () => {
      const fade = Math.min(1, Math.max(0, 1 - root.scrollTop / (window.innerHeight * 0.55)));
      setHintOpacity(fade);
      setParallax(Math.min(window.innerHeight, Math.max(0, root.scrollTop)));
      const benefits = document.getElementById("lp-benefits");
      if (benefits) {
        const local = Math.min(
          window.innerHeight,
          Math.max(0, -benefits.getBoundingClientRect().top),
        );
        setBenefitsParallax(local);
        const enter = Math.min(
          1,
          Math.max(0, 1 - benefits.getBoundingClientRect().top / window.innerHeight),
        );
        setBenefitsEnter(enter);
      }
      const calculator = document.getElementById("lp-calculator");
      if (calculator) {
        const local = Math.min(
          window.innerHeight,
          Math.max(0, -calculator.getBoundingClientRect().top),
        );
        setCalculatorParallax(local);
      }
      const join = document.getElementById("lp-join");
      if (join) {
        const progress = Math.min(
          1,
          Math.max(0, 1 - join.getBoundingClientRect().top / window.innerHeight),
        );
        setJoinProgress(progress);
      }
      if (programmaticScroll.current || submitted) return;
      let current = 0;
      for (let i = 0; i < SECTION_IDS.length; i += 1) {
        const el = document.getElementById(SECTION_IDS[i]);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= window.innerHeight * 0.4) {
          current = i;
        }
      }
      setIndex(current);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scratchDone, submitted]);

  const onScratchFinish = useCallback(() => {
    setScratchDone(true);
    setIndex(0);
  }, []);

  const onSubmitted = useCallback(() => setSubmitted(true), []);
  const onReset = useCallback(() => {
    setSubmitted(false);
    setIndex(0);
    requestAnimationFrame(() => {
      document.getElementById("lp-hero")?.scrollIntoView({ behavior: "auto" });
    });
  }, []);

  const onPlayAgain = useCallback(() => {
    setSubmitted(false);
    setScratchDone(false);
    setIndex(0);
  }, []);

  if (!scratchDone) {
    return <LpBuildScratch onFinish={onScratchFinish} />;
  }

  return (
    <LpBuildShell
      scrollerRef={scrollerRef}
      isDesktop={isDesktop}
      showDots={!submitted}
      dotsHigh={active >= 2}
      activeIndex={active}
      onSelectDot={goTo}
      onPlayAgain={onPlayAgain}
    >
      <div className="lp-build-stack">
        <section id="lp-hero" className="lp-build-section lp-build-section--hero">
          <LpBuildHero
            showScrollHint
            hintOpacity={hintOpacity}
            parallax={reduceMotion ? 0 : parallax}
          />
        </section>
        <section
          id="lp-benefits"
          className="lp-build-section lp-build-section--benefits"
        >
          <LpBuildBenefits
            onContinue={() => goTo(2)}
            onBack={() => goTo(0)}
            parallax={reduceMotion || isDesktop ? 0 : benefitsParallax}
            enter={reduceMotion || isDesktop ? 1 : benefitsEnter}
            disableStackAnimation={isDesktop}
          />
        </section>
        <section
          id="lp-calculator"
          className="lp-build-section lp-build-section--calculator"
        >
          <LpBuildCalculator
            onContinue={() => goTo(3)}
            parallax={reduceMotion ? 0 : calculatorParallax}
          />
        </section>
        <section id="lp-join" className="lp-build-section lp-build-section--join">
          <LpBuildJoin
            submitted={submitted}
            onSubmitted={onSubmitted}
            onReset={onReset}
            progress={reduceMotion ? 1 : joinProgress}
          />
        </section>
      </div>
    </LpBuildShell>
  );
}
