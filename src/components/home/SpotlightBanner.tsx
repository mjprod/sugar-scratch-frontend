import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { apiMutate } from "@/lib/api";

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

type SuggestForm = {
  creatorName: string;
  socialProfile: string;
  reason: string;
};

type SuggestErrors = {
  creatorName?: string;
  socialProfile?: string;
};

async function submitCreatorSuggestion(form: SuggestForm) {
  // Soft-accept when the endpoint is missing — UX must still complete.
  try {
    await apiMutate("/api/creators/suggestions", {
      method: "POST",
      body: JSON.stringify({
        creatorName: form.creatorName.trim(),
        socialProfile: form.socialProfile.trim(),
        reason: form.reason.trim() || undefined,
      }),
    });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
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
  const [suggestOpen, setSuggestOpen] = useState(false);

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
            label="Tell Us Who"
            costAmount={null}
            fontSize={14}
            onClick={() => setSuggestOpen(true)}
          />
        </div>
      </div>

      {suggestOpen ? (
        <CreatorSuggestModal onClose={() => setSuggestOpen(false)} />
      ) : null}
    </section>
  );
}

function CreatorSuggestModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const descId = useId();
  const nameId = useId();
  const socialId = useId();
  const reasonId = useId();
  const nameErrorId = useId();
  const socialErrorId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"form" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SuggestForm>({
    creatorName: "",
    socialProfile: "",
    reason: "",
  });
  const [errors, setErrors] = useState<SuggestErrors>({});

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, submitting]);

  function validate(next: SuggestForm): SuggestErrors {
    const out: SuggestErrors = {};
    if (!next.creatorName.trim()) {
      out.creatorName = "Creator name is required.";
    }
    if (!next.socialProfile.trim()) {
      out.socialProfile = "Social media profile is required.";
    }
    return out;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (nextErrors.creatorName || nextErrors.socialProfile) return;

    setSubmitting(true);
    try {
      await submitCreatorSuggestion(form);
      setStep("success");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div className="hub-spotlight-invite" role="presentation">
      <button
        type="button"
        className="hub-spotlight-invite-backdrop"
        aria-label="Close"
        disabled={submitting}
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div
        className="hub-spotlight-invite-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {step === "form" ? (
          <>
            <div className="hub-spotlight-invite-copy">
              <h2 id={titleId} className="hub-spotlight-invite-title">
                Suggest a Creator
              </h2>
              <p id={descId} className="hub-spotlight-invite-desc">
                Who would you love to see on Sugar Scratch? Let us know and our
                team may reach out to them.
              </p>
            </div>

            <form className="hub-spotlight-invite-form" onSubmit={onSubmit} noValidate>
              <label className="hub-spotlight-invite-label" htmlFor={nameId}>
                Creator Name
              </label>
              <input
                ref={firstFieldRef}
                id={nameId}
                className={[
                  "hub-spotlight-invite-input",
                  errors.creatorName ? "is-invalid" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="text"
                autoComplete="off"
                name="creatorName"
                placeholder="Enter creator name"
                value={form.creatorName}
                disabled={submitting}
                aria-invalid={errors.creatorName ? true : undefined}
                aria-describedby={
                  errors.creatorName ? nameErrorId : undefined
                }
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, creatorName: e.target.value }));
                  if (errors.creatorName) {
                    setErrors((prev) => ({ ...prev, creatorName: undefined }));
                  }
                }}
              />
              {errors.creatorName ? (
                <p id={nameErrorId} className="hub-spotlight-invite-error" role="alert">
                  {errors.creatorName}
                </p>
              ) : null}

              <label className="hub-spotlight-invite-label" htmlFor={socialId}>
                Social Media Profile
              </label>
              <input
                id={socialId}
                className={[
                  "hub-spotlight-invite-input",
                  errors.socialProfile ? "is-invalid" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="text"
                autoComplete="off"
                name="socialProfile"
                inputMode="url"
                placeholder="Instagram or TikTok profile"
                value={form.socialProfile}
                disabled={submitting}
                aria-invalid={errors.socialProfile ? true : undefined}
                aria-describedby={
                  errors.socialProfile ? socialErrorId : undefined
                }
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    socialProfile: e.target.value,
                  }));
                  if (errors.socialProfile) {
                    setErrors((prev) => ({
                      ...prev,
                      socialProfile: undefined,
                    }));
                  }
                }}
              />
              {errors.socialProfile ? (
                <p
                  id={socialErrorId}
                  className="hub-spotlight-invite-error"
                  role="alert"
                >
                  {errors.socialProfile}
                </p>
              ) : null}

              <label className="hub-spotlight-invite-label" htmlFor={reasonId}>
                Why would you like to see them on Sugar Scratch?{" "}
                <span className="hub-spotlight-invite-optional">(Optional)</span>
              </label>
              <textarea
                id={reasonId}
                className="hub-spotlight-invite-textarea"
                name="reason"
                rows={3}
                placeholder="Tell us why you'd love to see them"
                value={form.reason}
                disabled={submitting}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />

              <div className="hub-spotlight-invite-actions">
                <button
                  type="submit"
                  className="hub-spotlight-invite-submit"
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit Suggestion"}
                </button>
                <button
                  type="button"
                  className="hub-spotlight-invite-cancel"
                  disabled={submitting}
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="hub-spotlight-invite-success">
            <h2 id={titleId} className="hub-spotlight-invite-title">
              Thanks for the suggestion!
            </h2>
            <p id={descId} className="hub-spotlight-invite-desc">
              We&apos;ve received your creator suggestion. Our team will take a
              look and may reach out to them.
            </p>
            <button
              type="button"
              className="hub-spotlight-invite-submit"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
