import { useEffect, useRef, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

const EFFECT_STOP = 0.55;
const BG_EFFECT_STOP = 0.65;

const OFFSETS = {
  bg: { start: -133, end: 22 },
  women: { start: 38, end: 66 },
  logo: { start: -30, end: -59 },
} as const;

const MOBILE_OFFSETS = {
  bg: { start: -95, end: -73.01 },
  women: { start: 19.01, end: 2.07 },
  logo: { start: -32, end: -39 },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/**
 * Full-bleed homepage CTA band. Transforms stay on the compositor;
 * blur and brightness are pre-baked and faded, not filtered live.
 */
export function SpotlightBanner() {
  const rootRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const womenRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLImageElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const bg = bgRef.current;
    const women = womenRef.current;
    const logo = logoRef.current;
    const brand = brandRef.current;
    const blur = blurRef.current;
    const dim = dimRef.current;
    if (!root || !bg || !women || !logo || !brand || !blur || !dim) return;

    const scroller = root.closest<HTMLElement>("[data-page-scroll]") ?? null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 640px)");
    let raf = 0;
    let visible = true;
    let lastKey = "";

    const clearMotion = () => {
      lastKey = "";
      bg.style.transform = "";
      women.style.transform = "";
      logo.style.transform = "";
      brand.style.transform = "";
      women.style.opacity = "";
      blur.style.opacity = "0";
      dim.style.opacity = "0";
    };

    const paint = () => {
      raf = 0;
      if (reduce.matches || !visible) {
        if (reduce.matches) clearMotion();
        return;
      }

      const rect = root.getBoundingClientRect();
      const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const viewH = scroller ? scroller.clientHeight : window.innerHeight;
      const t = clamp((viewTop + viewH - rect.top) / viewH, 0, 1);
      const effectStop = mobile.matches ? 1 : EFFECT_STOP;
      const bgEffectStop = mobile.matches ? 1 : BG_EFFECT_STOP;
      const effectT = easeOutCubic(clamp(t / effectStop, 0, 1));
      const bgEffectT = easeOutCubic(clamp(t / bgEffectStop, 0, 1));
      const key = `${effectT.toFixed(3)}:${bgEffectT.toFixed(3)}:${mobile.matches ? "m" : "d"}`;
      if (key === lastKey) return;
      lastKey = key;

      const offsets = mobile.matches ? MOBILE_OFFSETS : OFFSETS;
      const bgY = lerp(offsets.bg.start, offsets.bg.end, bgEffectT);
      const womenY = lerp(offsets.women.start, offsets.women.end, effectT);
      const logoY = lerp(offsets.logo.start, offsets.logo.end, effectT);
      const womenScale = mobile.matches ? 1.03 : 1.25;
      const bgScale = mobile.matches ? 3.5 : 1.42;
      const logoScale = lerp(0.7, 0.75, effectT);

      bg.style.transform = `translate3d(0, ${bgY}px, 0) scale(${bgScale})`;
      women.style.transform = `translate3d(0, ${womenY.toFixed(2)}px, 0) scale(${womenScale})`;
      logo.style.transform = `translate3d(0, ${logoY.toFixed(2)}px, 0)`;
      brand.style.transform = `scale(${logoScale.toFixed(3)})`;
      women.style.opacity = lerp(0.7, 1, effectT).toFixed(3);
      blur.style.opacity = mobile.matches ? "0" : effectT.toFixed(3);
      dim.style.opacity = mobile.matches ? "0" : lerp(0.7, 0, effectT).toFixed(3);
    };

    const queue = () => {
      if (!raf) raf = window.requestAnimationFrame(paint);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) queue();
      },
      { root: scroller, rootMargin: "80px 0px" },
    );
    io.observe(root);

    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    reduce.addEventListener("change", queue);
    mobile.addEventListener("change", queue);
    paint();

    return () => {
      io.disconnect();
      target.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      reduce.removeEventListener("change", queue);
      mobile.removeEventListener("change", queue);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="hub-spotlight-band"
      aria-label="Want to see your favourite creator in Sugar Scratch"
    >
      <div ref={bgRef} className="hub-spotlight-band-layer hub-spotlight-band-bg">
        <img
          src="/images/ctabannerbg.jpg"
          alt=""
          draggable={false}
          decoding="async"
        />
        <img
          ref={blurRef}
          className="hub-spotlight-band-bg-blur"
          src="/images/ctabannerbg.jpg"
          alt=""
          draggable={false}
          decoding="async"
        />
        <div ref={dimRef} className="hub-spotlight-band-bg-dim" />
      </div>
      <div
        ref={womenRef}
        className="hub-spotlight-band-layer hub-spotlight-band-women"
      >
        <img
          src="/images/woman-2.png"
          alt=""
          draggable={false}
          decoding="async"
        />
      </div>
      <div
        ref={logoRef}
        className="hub-spotlight-band-layer hub-spotlight-band-logo"
      >
        <div ref={brandRef} className="hub-spotlight-band-brand">
          <p className="hub-spotlight-band-copy">
            Want to see your favourite creator in
          </p>
          <img
            src="/svg/logoSugarScratch.svg"
            alt=""
            draggable={false}
            decoding="async"
          />
        </div>
        <div className="hub-spotlight-band-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Send them an invitation"
            costAmount={null}
            fontSize={14}
            onClick={() => setInviteOpen(true)}
          />
        </div>
      </div>

      {inviteOpen ? (
        <div className="hub-spotlight-invite" role="presentation">
          <button
            type="button"
            className="hub-spotlight-invite-backdrop"
            aria-label="Close"
            onClick={() => setInviteOpen(false)}
          />
          <div
            className="hub-spotlight-invite-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-spotlight-invite-title"
          >
            <p id="hub-spotlight-invite-title">email action taken</p>
            <button
              type="button"
              className="hub-spotlight-invite-close"
              onClick={() => setInviteOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
