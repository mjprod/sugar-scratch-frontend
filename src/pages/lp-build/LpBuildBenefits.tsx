import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
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

export function LpBuildBenefits({
  onContinue,
  onBack,
  parallax = 0,
  enter = 1,
}: {
  onContinue: () => void;
  onBack: () => void;
  parallax?: number;
  enter?: number;
}) {
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
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    axis: "undecided" | "x" | "y";
  } | null>(null);
  const onContinueRef = useRef(onContinue);
  const onBackRef = useRef(onBack);
  const [active, setActive] = useState(0);
  const [grabbing, setGrabbing] = useState(false);

  onContinueRef.current = onContinue;
  onBackRef.current = onBack;

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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      swipeRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        axis: "undecided",
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const swipe = swipeRef.current;
      const touch = event.touches[0];
      if (!swipe || !touch) return;
      const dx = touch.clientX - swipe.startX;
      const dy = touch.clientY - swipe.startY;
      if (swipe.axis === "undecided") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        swipe.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      }
      if (swipe.axis === "y") event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      const swipe = swipeRef.current;
      swipeRef.current = null;
      if (!swipe) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dy = touch.clientY - swipe.startY;
      if (swipe.axis !== "y") return;
      if (dy <= -36) onContinueRef.current();
      if (dy >= 36) onBackRef.current();
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return (
    <>
      <div className="lp-build-page3-wrap">
        <div
          className="lp-build-page3-headline"
          style={{ transform: `translate3d(0, ${-parallax * 0.22}px, 0)` }}
        >
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
        <div
          className="lp-build-page3-carousel-wrap"
          style={{
            opacity:
              1 -
              Math.max(
                Math.min(1, Math.max(0, parallax / 280)),
                1 - Math.min(1, Math.max(0, enter)),
              ),
          }}
        >
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
            {MOCK_CARDS.map((card, cardIndex) => {
              const leave = Math.min(1, Math.max(0, parallax / 280));
              const arrive = 1 - Math.min(1, Math.max(0, enter));
              const amount = Math.max(leave, arrive);
              const fromLeft = cardIndex % 2 === 0;
              const stackX = (fromLeft ? 1 : -1) * amount * 42;
              const stackY = amount * cardIndex * 10;
              return (
              <article
                key={card.title}
                className="lp-build-page3-card"
                style={{
                  transform: `translate3d(${stackX}px, ${stackY}px, 0)`,
                  zIndex: MOCK_CARDS.length - cardIndex,
                }}
              >
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
              );
            })}
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
        <div
          className="lp-build-page3-cta-block"
          style={{ transform: `translate3d(0, ${-parallax * 0.55}px, 0)` }}
        >
          <p className="lp-build-page3-cta-title">How much money is in it for you?</p>
          <div className="lp-build-page3-cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              label="Find Out Now"
              costAmount={null}
              fontSize={14}
              onClick={onContinue}
            />
          </div>
        </div>
      </div>
    </>
  );
}
