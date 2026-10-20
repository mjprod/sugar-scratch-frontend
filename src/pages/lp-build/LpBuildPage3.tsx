import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { LpBuildShell } from "@/pages/lp-build/LpBuildShell";
import { Paths } from "@/routes/Paths";
import { loadModels, modelCoverUrl } from "@/services/models";

const MOCK_CARDS = [
  {
    title: "Themes",
    copy: "We create fresh content to keep users buying packs and playing.",
    badgeId: "01",
  },
  {
    title: "Inexpensive for Users",
    copy: "We offer photo cards for low cost in-game diamonds.",
    badgeId: "02",
  },
  {
    title: "Exclusive Content",
    copy: "We create tiered content that users pay without you lifting a finger.",
    badgeId: "03",
  },
  {
    title: "International Reach",
    copy: "Our game is available internationally and in many languages.",
    badgeId: "04",
  },
  {
    title: "Personal Manager",
    copy: "Every creator gets a personal account manager.",
    badgeId: "05",
  },
  {
    title: "Gifting",
    copy: "Users ability to send you digital gifts will be coming in 2027",
    badgeId: "06",
    badge: "Coming Soon",
  },
] as const;

function PackBadge({ id }: { id: string }) {
  const base = `/images/lp-build/pack-badge-${id}`;
  return (
    <picture>
      <source
        type="image/jxl"
        srcSet={`${base}.jxl 1x, ${base}@2x.jxl 2x`}
      />
      <source
        type="image/webp"
        srcSet={`${base}.webp 1x, ${base}@2x.webp 2x`}
      />
      <img
        src={`${base}.png`}
        srcSet={`${base}.png 1x, ${base}@2x.png 2x`}
        alt=""
        draggable={false}
      />
    </picture>
  );
}

export function LpBuildPage3() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modelId =
    searchParams.get("model")?.trim() ||
    searchParams.get("username")?.trim() ||
    "julianaval";
  const [coverUrl, setCoverUrl] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);
  const [active, setActive] = useState(0);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadModels().then((models) => {
      if (cancelled) return;
      const model =
        models.find((entry) => entry.id?.trim() === modelId) ??
        models.find(
          (entry) => (entry.id ?? "").toLowerCase() === modelId.toLowerCase(),
        );
      setCoverUrl(modelCoverUrl(model) ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const syncActive = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = [
      ...scroller.querySelectorAll<HTMLElement>(".lp-build-page3-card"),
    ];
    if (!cards.length) return;
    const mid = scroller.scrollLeft + scroller.clientWidth / 2;
    let next = 0;
    let best = Infinity;
    cards.forEach((card, index) => {
      const center = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(center - mid);
      if (distance < best) {
        best = distance;
        next = index;
      }
    });
    setActive(next);
  };

  return (
    <LpBuildShell>
      <div className="lp-build-page3-wrap">
      <div className="lp-build-page3-headline">
        Fun for your fans.
        <br />
        <span className="lp-build-page3-headline-play">
          <img
            src="/svg/squiggle.svg"
            alt=""
            className="lp-build-page3-headline-squiggle"
            aria-hidden="true"
            draggable={false}
          />
          <span className="lp-build-page3-headline-play-text">Money for you.</span>
        </span>
      </div>
      <div className="lp-build-page3-carousel-wrap">
        <div
          ref={scrollerRef}
          className={[
            "lp-build-page3-carousel",
            grabbing ? "is-grabbing" : "",
            active === MOCK_CARDS.length - 1 ? "is-end" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="How it works"
          onScroll={syncActive}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") return;
            const scroller = scrollerRef.current;
            if (!scroller) return;
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startScroll: scroller.scrollLeft,
              moved: false,
            };
            scroller.setPointerCapture(event.pointerId);
            setGrabbing(true);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const scroller = scrollerRef.current;
            if (!drag || !scroller || drag.pointerId !== event.pointerId) return;
            const delta = event.clientX - drag.startX;
            if (Math.abs(delta) > 3) drag.moved = true;
            scroller.scrollLeft = drag.startScroll - delta;
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            dragRef.current = null;
            setGrabbing(false);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setGrabbing(false);
          }}
        >
          <div className="lp-build-page3-carousel-spacer" aria-hidden="true" />
          {MOCK_CARDS.map((card) => (
            <article key={card.title} className="lp-build-page3-card">
              {coverUrl ? (
                <div className="lp-build-page3-card-bg" aria-hidden="true">
                  <img src={coverUrl} alt="" />
                  <span className="lp-build-page3-card-veil" />
                </div>
              ) : null}
              <div className="lp-build-page3-card-media">
                <PackBadge id={card.badgeId} />
              </div>
              <div className="lp-build-page3-card-copy">
                <div className="lp-build-page3-card-heading">
                  <h3>{card.title}</h3>
                  {"badge" in card && card.badge ? (
                    <span className="lp-build-page3-card-badge">{card.badge}</span>
                  ) : null}
                </div>
                <p>{card.copy}</p>
              </div>
            </article>
          ))}
          <div className="lp-build-page3-carousel-spacer" aria-hidden="true" />
        </div>
        <nav
          className="lp-build-page3-carousel-dots glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-80 glass-surface"
          aria-label="Carousel"
        >
          {MOCK_CARDS.map((card, index) => (
            <span
              key={card.title}
              className={
                index === active
                  ? "lp-build-dot is-active"
                  : "lp-build-dot"
              }
            />
          ))}
        </nav>
      </div>
      <div className="lp-build-page3-cta-block">
        <p className="lp-build-page3-cta-title">How much could you earn?</p>
        <div className="lp-build-page3-cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            fillParent
            label="Find Out Now"
            costAmount={null}
            fontSize={14}
            onClick={() => navigate(Paths.lpBuildPage4)}
          />
        </div>
      </div>
      </div>
      <p className="lp-build-scroll-hint">or scroll down to find out more</p>
    </LpBuildShell>
  );
}
