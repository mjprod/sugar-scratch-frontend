import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { CoverflowStatusPager } from "@/components/home/CoverflowStatusPager";
import { useAuth } from "@/contexts/AuthContext";
import { useMarkPageReady } from "@/shared/ui/PageTransition";

const GUEST_HOME_VIDEO = "/video/homepagevideo-min.mp4";

type GuestSlide =
  | { id: "video"; kind: "video" }
  | {
      id: string;
      kind: "step";
      title: string;
      sentence: string;
      imageSrc: string;
      imageClassName?: string;
    };

/** Guest how-to slides — art matches signed-in How to Play order. */
const GUEST_HOW_TO_SLIDES: Extract<GuestSlide, { kind: "step" }>[] = [
  {
    id: "scratch-match",
    kind: "step",
    title: "Scratch & Match",
    sentence: "Scratch & reveal and match the symbols to win photo cards.",
    imageSrc: "/images/home-v2/how-scratch.png",
    imageClassName: "is-scratch",
  },
  {
    id: "win-photo-cards",
    kind: "step",
    title: "Win Photo Cards",
    sentence: "Scratch the photo cards to collect diamonds.",
    imageSrc: "/images/home-v2/how-win.png",
    imageClassName: "is-win",
  },
  {
    id: "complete-collection",
    kind: "step",
    title: "Complete the collection",
    sentence: "Complete each theme to get exclusive spicy content.",
    imageSrc: "/images/home-v2/how-collect.png",
    imageClassName: "is-collect",
  },
];

const GUEST_SLIDES: GuestSlide[] = [
  { id: "video", kind: "video" },
  ...GUEST_HOW_TO_SLIDES,
];

const SWIPE_THRESHOLD_PX = 48;

export function GuestHomeLanding() {
  const { openCreateAccount } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    axis: "undecided" | "x" | "y";
    dragging: boolean;
  } | null>(null);

  const [index, setIndex] = useState(0);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const slideCount = GUEST_SLIDES.length;
  const active = Math.max(0, Math.min(index, slideCount - 1));

  useMarkPageReady(canPlay || active !== 0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const markCanPlay = () => setCanPlay(true);
    video.addEventListener("canplay", markCanPlay);
    video.addEventListener("playing", markCanPlay);

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    if (reduceMotion) {
      video.pause();
      setCanPlay(true);
      return () => {
        video.removeEventListener("canplay", markCanPlay);
        video.removeEventListener("playing", markCanPlay);
      };
    }

    if (active === 0) {
      const play = video.play();
      if (play && typeof play.catch === "function") {
        void play.catch(() => setCanPlay(true));
      }
    } else {
      video.pause();
    }

    if (video.readyState >= 3) setCanPlay(true);
    const fallback = window.setTimeout(() => setCanPlay(true), 2500);

    return () => {
      window.clearTimeout(fallback);
      video.removeEventListener("canplay", markCanPlay);
      video.removeEventListener("playing", markCanPlay);
    };
  }, [active, reduceMotion]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(next, slideCount - 1)));
      setDragOffsetPx(0);
      setIsDragging(false);
    },
    [slideCount],
  );

  const endDrag = useCallback(
    (clientX: number) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);

      if (!drag || drag.axis !== "x") {
        setDragOffsetPx(0);
        return;
      }

      const delta = clientX - drag.startX;
      if (delta <= -SWIPE_THRESHOLD_PX && active < slideCount - 1) {
        goTo(active + 1);
        return;
      }
      if (delta >= SWIPE_THRESHOLD_PX && active > 0) {
        goTo(active - 1);
        return;
      }
      setDragOffsetPx(0);
    },
    [active, goTo, slideCount],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      axis: "undecided",
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.axis === "undecided") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.axis = "y";
        return;
      }
      drag.axis = "x";
      drag.dragging = true;
      setIsDragging(true);
    }

    if (drag.axis !== "x") return;

    drag.lastX = event.clientX;
    // Resist past ends a little so the track doesn't feel rubber-band free.
    let offset = dx;
    if ((active === 0 && dx > 0) || (active === slideCount - 1 && dx < 0)) {
      offset = dx * 0.35;
    }
    setDragOffsetPx(offset);
    event.preventDefault();
  }, [active, slideCount]);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
      endDrag(event.clientX);
    },
    [endDrag],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag(drag.lastX);
    },
    [endDrag],
  );

  const trackStyle = {
    transform: `translate3d(calc(${-active * 100}% + ${dragOffsetPx}px), 0, 0)`,
    transition: isDragging || reduceMotion ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
  } as const;

  return (
    <section className="guest-home-landing" aria-label="Welcome" aria-roledescription="carousel">
      <div
        ref={trackRef}
        className={[
          "guest-home-landing__track",
          isDragging ? "is-dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={trackStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {GUEST_SLIDES.map((slide, slideIndex) => {
          const isActive = slideIndex === active;
          if (slide.kind === "video") {
            return (
              <div
                key={slide.id}
                className="guest-home-landing__slide guest-home-landing__slide--video"
                aria-hidden={!isActive}
              >
                <video
                  ref={videoRef}
                  className="guest-home-landing__video"
                  src={GUEST_HOME_VIDEO}
                  autoPlay={!reduceMotion}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                  disableRemotePlayback
                  aria-hidden
                />
              </div>
            );
          }

          return (
            <div
              key={slide.id}
              className={[
                "guest-home-landing__slide",
                "guest-home-landing__slide--step",
                slide.imageClassName ? `is-${slide.imageClassName.replace(/^is-/, "")}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden={!isActive}
            >
              <div className="guest-home-landing__step-art" aria-hidden>
                <img src={slide.imageSrc} alt="" draggable={false} />
              </div>
              <div className="guest-home-landing__step-copy">
                <p className="guest-home-landing__step-kicker">How to play</p>
                <h2 className="guest-home-landing__step-title">{slide.title}</h2>
                <p className="guest-home-landing__step-sentence">{slide.sentence}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="guest-home-landing__scrim" aria-hidden />

      <div className="guest-home-landing__footer">
        <CoverflowStatusPager
          className="guest-home-landing__status-pager"
          count={slideCount}
          activeIndex={active}
          onSelectIndex={goTo}
          ariaLabel="Welcome slides"
          itemLabel={(index, total) => {
            const slide = GUEST_SLIDES[index];
            if (!slide) return `Slide ${index + 1} of ${total}`;
            if (slide.kind === "video") return `Welcome video, slide 1 of ${total}`;
            return `${slide.title}: ${slide.sentence}, slide ${index + 1} of ${total}`;
          }}
        />

        <div className="guest-home-landing__cta">
          <CtaButton
            {...ctaButtonPropsFromTemplate("squircleCTA")}
            label="Get Started FREE"
            costAmount={null}
            onClick={openCreateAccount}
          />
        </div>
      </div>
    </section>
  );
}
