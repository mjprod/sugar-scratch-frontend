import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, X } from "lucide-react";
import { EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper/types";
import {
  CtaButton,
  ctaButtonPropsFromTemplate,
} from "@/shared/ui/cta";
import {
  addPackToCart,
  isPackInCart,
  subscribeCart,
} from "@/services/cart";
import { formatPackPrice, type Iteration } from "@/features/packs/types";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "@/features/packs/packs.css";
import "./MobileCssCarousel.css";

const BUY_PACK_CTA_SIZE_MOBILE = {
  width: 176,
  height: 42,
  fontSize: 13,
  strokeWidth: 2,
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function PackSlideHud({
  item,
  active,
  pocketed,
  buyConfirmOpen,
  buyConfirmLeaving,
  confirmingAdd,
  onToggleBuyConfirm,
  onCloseBuyConfirm,
  onConfirmBuy,
  onAddToPocket,
  onBuyConfirmLeaveEnd,
  onConfirmingAddEnd,
}: {
  item: Iteration;
  active: boolean;
  pocketed: boolean;
  buyConfirmOpen: boolean;
  buyConfirmLeaving: boolean;
  confirmingAdd: boolean;
  onToggleBuyConfirm: () => void;
  onCloseBuyConfirm: () => void;
  onConfirmBuy: () => void;
  onAddToPocket: () => void;
  onBuyConfirmLeaveEnd: () => void;
  onConfirmingAddEnd: () => void;
}) {

  return (
    <div
      className={`coverflow-active-stack coverflow-active-stack--html mobile-css-carousel__hud swiper-no-swiping${
        active ? " is-visible" : ""
      }`}
      aria-hidden={!active}
    >
      <div
        className={`coverflow-buy-pack-cta${
          confirmingAdd ? " is-confirming" : ""
        }${buyConfirmOpen || buyConfirmLeaving ? " is-buy-confirm-open" : ""}`}
        onAnimationEnd={(event) => {
          if (event.animationName !== "coverflow-buy-cta-confirm") return;
          onConfirmingAddEnd();
        }}
      >
        <div className="coverflow-buy-pack-cta__primary">
          <CtaButton
            {...ctaButtonPropsFromTemplate("hexGoldCTA")}
            {...BUY_PACK_CTA_SIZE_MOBILE}
            auroraPaused
            glowOuterBloom="off"
            costIconAnimated={false}
            label="Buy Pack"
            costAmount={formatPackPrice(item.price ?? 4.99)}
            className="coverflow-buy-pack-cta__button"
            tabIndex={active ? 0 : -1}
            aria-expanded={buyConfirmOpen || buyConfirmLeaving}
            aria-controls={`coverflow-buy-confirm-${item.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleBuyConfirm();
            }}
          />
          {buyConfirmOpen || buyConfirmLeaving ? (
            <div
              id={`coverflow-buy-confirm-${item.id}`}
              className={`coverflow-cart-remove-confirm coverflow-buy-confirm${
                buyConfirmLeaving ? " is-leaving" : ""
              }`}
              role="dialog"
              aria-label="Buy pack?"
              aria-modal="false"
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.animationName !== "coverflow-confirm-leave") return;
                onBuyConfirmLeaveEnd();
              }}
            >
              <p className="coverflow-cart-remove-confirm__label">Buy</p>
              <div className="coverflow-cart-remove-confirm__actions">
                <button
                  type="button"
                  className="coverflow-cart-remove-confirm__btn is-cancel"
                  aria-label="Cancel buy"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseBuyConfirm();
                  }}
                >
                  <X aria-hidden="true" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="coverflow-cart-remove-confirm__btn is-confirm"
                  aria-label="Confirm buy"
                  onClick={(event) => {
                    event.stopPropagation();
                    onConfirmBuy();
                  }}
                >
                  <Check aria-hidden="true" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="coverflow-add-to-pocket"
          tabIndex={active ? 0 : -1}
          disabled={pocketed}
          aria-disabled={pocketed || undefined}
          aria-label={pocketed ? "Already in Pack Pocket" : "Add to Pocket"}
          onClick={(event) => {
            event.stopPropagation();
            onAddToPocket();
          }}
        >
          <PackPocketIcon className="coverflow-add-to-pocket__icon" />
          <span className="coverflow-add-to-pocket__label">
            {pocketed ? "In Pocket" : "Add to Pocket"}
          </span>
        </button>
      </div>
    </div>
  );
}

function PackPocketIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <path d="M4.8 3h14.4c.477 0 .935.199 1.273.553S21 4.388 21 4.89v6.667c0 2.504-.948 4.907-2.636 6.678S14.387 21 12 21a8.6 8.6 0 0 1-3.444-.719a9 9 0 0 1-2.92-2.047C3.948 16.463 3 14.06 3 11.556V4.889c0-.501.19-.982.527-1.336A1.76 1.76 0 0 1 4.8 3" />
        <path d="M12 7.75v6.5" />
        <path d="M8.75 11h6.5" />
      </g>
    </svg>
  );
}

export function MobileCssCarousel({
  items,
  onReady,
}: {
  items: Iteration[];
  onReady?: () => void;
}) {
  const videosRef = useRef<Array<HTMLVideoElement | null>>([]);
  const swiperRef = useRef<SwiperClass | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  const readySent = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pocketTick, setPocketTick] = useState(0);
  const [buyConfirmOpen, setBuyConfirmOpen] = useState(false);
  const [buyConfirmLeaving, setBuyConfirmLeaving] = useState(false);
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  onReadyRef.current = onReady;
  const activeItem = items[activeIndex];

  function closeBuyConfirm() {
    setBuyConfirmOpen(false);
    setBuyConfirmLeaving(!prefersReducedMotion());
  }

  function toggleBuyConfirm() {
    if (buyConfirmOpen) closeBuyConfirm();
    else {
      setBuyConfirmLeaving(false);
      setBuyConfirmOpen(true);
    }
  }

  function addActiveToPocket() {
    if (!activeItem) return;
    if (isPackInCart(activeItem.id, activeItem.characterId)) return;
    if (!prefersReducedMotion()) setConfirmingAdd(true);
    addPackToCart({
      packId: activeItem.id,
      packName: activeItem.packName || activeItem.name,
      creator: activeItem.girlName,
      characterId: activeItem.characterId,
      price: activeItem.price,
      videoUrl: activeItem.videoUrl,
      packNumber: activeItem.packNumber,
      flagEmoji: activeItem.flagEmoji,
      flagSvgUrl: activeItem.flagSvgUrl,
      city: activeItem.city,
      country: activeItem.country,
      overlayColorStart: activeItem.overlayColorStart,
      overlayColorEnd: activeItem.overlayColorEnd,
      backgroundColor: activeItem.backgroundColor,
    });
  }

  const neighborLoaded = useCallback(() => {
    const needed = Math.min(2, items.length);
    return Array.from({ length: needed }, (_, index) => videosRef.current[index]).every(
      (video) => video != null && video.readyState >= 2,
    );
  }, [items.length]);

  const neighborOnScreen = useCallback((swiper: SwiperClass) => {
    const next = swiper.slides[swiper.activeIndex + 1] as HTMLElement | undefined;
    if (!next) return true;
    const rect = next.getBoundingClientRect();
    return rect.left < window.innerWidth - 8 && rect.right > 8;
  }, []);

  const markReady = useCallback(
    (swiper: SwiperClass) => {
      if (readySent.current) return;
      if (!neighborOnScreen(swiper) || !neighborLoaded()) return;
      readySent.current = true;
      onReadyRef.current?.();
    },
    [neighborLoaded, neighborOnScreen],
  );

  const applySlideBrightness = useCallback((swiper: SwiperClass) => {
    swiper.slides.forEach((slide) => {
      const t = Math.min(1, Math.abs(slide.progress));
      const eased = t * t * (3 - 2 * t);
      slide.style.setProperty("--slide-brightness", String(1 - 0.5 * eased));
      slide.style.setProperty("--slide-light", String(1 - eased));
    });
  }, []);

  const syncPlayback = useCallback((next: number) => {
    setActiveIndex(next);
    setBuyConfirmOpen(false);
    setBuyConfirmLeaving(false);
    videosRef.current.forEach((video, index) => {
      if (!video) return;
      const distance = Math.abs(index - next);
      if (distance === 0) {
        void video.play().catch(() => {});
        return;
      }
      if (distance <= 2) {
        if (video.readyState < 2) video.load();
        else video.pause();
        return;
      }
      video.pause();
    });
  }, []);

  function onSwiper(swiper: SwiperClass) {
    swiperRef.current = swiper;
    videosRef.current.length = items.length;
    videosRef.current.slice(0, 2).forEach((video) => video?.load());
    syncPlayback(swiper.activeIndex);
    applySlideBrightness(swiper);
    swiper.update();
    applySlideBrightness(swiper);
    markReady(swiper);
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (readySent.current) return;
      readySent.current = true;
      onReadyRef.current?.();
    }, 2500);
    return () => window.clearTimeout(id);
  }, [items]);

  useEffect(() => subscribeCart(() => setPocketTick((n) => n + 1)), []);

  useEffect(() => {
    if (!buyConfirmOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBuyConfirm();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buyConfirmOpen]);

  useEffect(() => {
    if (!buyConfirmLeaving) return;
    const timeout = window.setTimeout(() => setBuyConfirmLeaving(false), 400);
    return () => window.clearTimeout(timeout);
  }, [buyConfirmLeaving]);

  useEffect(() => {
    if (!confirmingAdd) return;
    const timeout = window.setTimeout(() => setConfirmingAdd(false), 580);
    return () => window.clearTimeout(timeout);
  }, [confirmingAdd]);

  // Coverflow 3D transforms break hit-testing; keep CTAs inside slides visually
  // and resolve taps by screen rect on the shell.
  function handleShellPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const shell = shellRef.current;
    const swiper = swiperRef.current;
    if (!shell || !swiper) return;
    const active = swiper.slides[swiper.activeIndex] as HTMLElement | undefined;
    if (!active) return;
    const x = event.clientX;
    const y = event.clientY;
    const targets = active.querySelectorAll<HTMLElement>(
      ".coverflow-buy-confirm .is-confirm, .coverflow-buy-confirm .is-cancel, .coverflow-buy-pack-cta__button, .coverflow-add-to-pocket",
    );
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      event.preventDefault();
      event.stopPropagation();
      if (el.classList.contains("is-confirm")) {
        closeBuyConfirm();
        return;
      }
      if (el.classList.contains("is-cancel")) {
        closeBuyConfirm();
        return;
      }
      if (el.classList.contains("coverflow-buy-pack-cta__button")) {
        toggleBuyConfirm();
        return;
      }
      if (el.classList.contains("coverflow-add-to-pocket")) {
        addActiveToPocket();
        return;
      }
    }
  }

  return (
    <div
      ref={shellRef}
      className="mobile-css-carousel-shell"
      onPointerUp={handleShellPointerUp}
    >
      <Swiper
        className="mobile-css-carousel"
        modules={[EffectCoverflow]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        spaceBetween={-72}
        speed={720}
        resistanceRatio={0.85}
        watchSlidesProgress
        coverflowEffect={{
          rotate: 38,
          stretch: -88,
          depth: 80,
          scale: 0.9,
          modifier: 1,
          slideShadows: true,
        }}
        onSwiper={onSwiper}
        onProgress={applySlideBrightness}
        onSetTranslate={(swiper) => {
          applySlideBrightness(swiper);
          markReady(swiper);
        }}
        onSlideChange={(swiper) => syncPlayback(swiper.activeIndex)}
        preventClicks={false}
        preventClicksPropagation={false}
        noSwipingSelector=".mobile-css-carousel__hud, .coverflow-buy-pack-cta, .coverflow-add-to-pocket, .coverflow-cart-remove-confirm, .cta-button"
      >
        {items.map((item, index) => {
          const pocketed = isPackInCart(item.id, item.characterId);
          void pocketTick;
          const isActive = index === activeIndex;
          return (
            <SwiperSlide key={item.id}>
              <div className="mobile-css-carousel__pack">
                <video
                  ref={(node) => {
                    videosRef.current[index] = node;
                  }}
                  src={item.videoUrl || undefined}
                  muted
                  loop
                  playsInline
                  autoPlay={index === 0}
                  preload={
                    index <= 2 || Math.abs(index - activeIndex) <= 2
                      ? "auto"
                      : "metadata"
                  }
                  onLoadedData={() => {
                    const swiper = swiperRef.current;
                    if (swiper) markReady(swiper);
                  }}
                />
                <div
                  className="mobile-css-carousel__light"
                  aria-hidden="true"
                  style={{
                    ["--overlay-color-start" as string]:
                      item.overlayColorStart || item.backgroundColor,
                    ["--overlay-color-end" as string]:
                      item.overlayColorEnd || item.backgroundColor,
                  }}
                />
              </div>
              <PackSlideHud
                item={item}
                active={isActive}
                pocketed={pocketed}
                buyConfirmOpen={isActive && buyConfirmOpen}
                buyConfirmLeaving={isActive && buyConfirmLeaving}
                confirmingAdd={isActive && confirmingAdd}
                onToggleBuyConfirm={toggleBuyConfirm}
                onCloseBuyConfirm={closeBuyConfirm}
                onConfirmBuy={closeBuyConfirm}
                onAddToPocket={addActiveToPocket}
                onBuyConfirmLeaveEnd={() => setBuyConfirmLeaving(false)}
                onConfirmingAddEnd={() => setConfirmingAdd(false)}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
