import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { PlayConfirm } from "@/components/static-card/PlayConfirm";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import { packUnitCost } from "@/services/purchase";
import {
  MotionCardStack,
} from "@/components/motion-card/MotionCardStack";
import type {
  MotionCardState,
} from "@/components/motion-card/MotionCard";
import type { ThreeMotionItem } from "@/components/motion-card/ThreeMotion";
import {
  StaticCarousel,
  type StaticCarouselItem,
} from "@/components/static-card/StaticCarousel";
import type { MotionCardTheme } from "@/components/motion-card/MotionCard";
import { PhotoGateway } from "@/components/photo-gateway/PhotoGateway";

type MotionCardHolderProps = {
  items: ThreeMotionItem[];
  photos?: StaticCarouselItem[];
  initialActiveId?: string | null;
  onItemSelect?: (id: string, next: MotionCardState) => void;
  className?: string;
};

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const SHIFT = { duration: 1.04, ease: APPLE_EASE };
const DETAILS_DELAY = 0.15;
const GAP = 12;
const PANEL_GAP = 16;

function cardLeft(index: number, cardW: number) {
  return -index * (cardW + GAP);
}

function exitX(index: number, activeIndex: number, cardW: number) {
  const off = cardW + GAP;
  if (activeIndex === 1) return index === 0 ? -off * 2 : off * 2;
  if (activeIndex === 2) return -off * 2;
  return off * 2;
}

function exitDelay(index: number, activeIndex: number) {
  if (activeIndex === 2) return index * 0.08;
  const order = [0, 1, 2]
    .filter((i) => i !== activeIndex)
    .sort((a, b) => b - a);
  const place = order.indexOf(index);
  return place < 0 ? 0 : place * 0.16;
}

function enterDelay(index: number) {
  return (2 - index) * 0.16;
}

const SQUIRCLE_CTA = ctaButtonPropsFromTemplate("squircleCTA");

const THEME_LABEL: Record<MotionCardTheme, string> = {
  police: "Police",
  nurse: "Nurse",
  fire: "Fire",
  gym: "Gym",
  teacher: "Teacher",
};

function gatewayCards(items: StaticCarouselItem[]) {
  return items.flatMap((item) => {
    const backgroundUrl = item.backgroundUrl?.trim() || "";
    const topLayerUrl = item.topLayerUrl?.trim() || "";
    if (!backgroundUrl && !topLayerUrl) return [];
    return [
      {
        id: item.id,
        backgroundUrl: backgroundUrl || topLayerUrl,
        topLayerUrl,
      },
    ];
  });
}

function exitDuration() {
  return SHIFT.duration;
}

/**
 * Three-up motion row that expands into Active Motion on click.
 * Unused cards slide right off-screen, staggered.
 */
export function MotionCardHolder({
  items,
  photos = [],
  initialActiveId = null,
  onItemSelect,
  className,
}: MotionCardHolderProps) {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [detailsReady, setDetailsReady] = useState(Boolean(initialActiveId));
  const lastActiveIndex = useRef(0);
  const detailsTimer = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const playCtaRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(108);
  const [cardH, setCardH] = useState(0);
  const [confirmPlay, setConfirmPlay] = useState(false);
  const [photoOpenSignal, setPhotoOpenSignal] = useState(0);
  const [photoOverlayOpen, setPhotoOverlayOpen] = useState(false);
  const cards = items.slice(0, 3);
  const activeIndex = cards.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0;
  const activeCard = active ? cards[activeIndex] : null;
  const instant = reduceMotion ? { duration: 0 } : SHIFT;

  const openRef = useRef(false);
  openRef.current = active;

  const closeActive = (item: ThreeMotionItem) => {
    if (detailsTimer.current != null) {
      window.clearTimeout(detailsTimer.current);
      detailsTimer.current = null;
    }
    setActiveId(null);
    setDetailsReady(false);
    setConfirmPlay(false);
    setPhotoOpenSignal(0);
    setPhotoOverlayOpen(false);
    onItemSelect?.(
      item.id,
      (item.state ?? "").startsWith("locked")
        ? "locked-unselected-banner"
        : "unlocked-unselected",
    );
  };

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const measure = () => {
      const slot = node.children[0] as HTMLElement | undefined;
      if (!slot) return;
      const face = slot.querySelector(".aspect-\\[108\\/210\\.5\\]");
      const box = (face ?? slot).getBoundingClientRect();
      if (box.height > 0) setCardH(box.height);
      if (openRef.current) return;
      setCardW(slot.getBoundingClientRect().width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (detailsTimer.current != null) window.clearTimeout(detailsTimer.current);
    };
  }, []);



  return (
    <div
      className={[
        "motion-card-holder relative w-full",
        active ? "is-open" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        ref={rowRef}
        className="grid w-full grid-cols-3 items-start gap-3"
      >
        {cards.map((item, index) => {
          const selected = item.id === activeId;
          const shift = !active
            ? 0
            : selected
              ? cardLeft(index, cardW)
              : exitX(index, activeIndex, cardW);
          if (active) lastActiveIndex.current = activeIndex;
          const delay = active
            ? selected
              ? 0
              : exitDelay(index, activeIndex)
            : enterDelay(index);

          return (
            <m.div
              key={item.id}
              className={[
                "motion-card-holder__slot relative z-[1] min-w-0",
                selected && active ? "motion-card-holder__selected" : "",
              ].join(" ")}
              style={{
                zIndex: selected ? 2 : 1,
                ...(selected && active ? { width: cardW } : {}),
              }}
              initial={false}
              animate={{
                x: shift,
                opacity: !active || selected ? 1 : 0,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: exitDuration(),
                      ease: APPLE_EASE,
                      delay,
                    }
              }
            >
              <MotionCardStack
                state={item.state}
                theme={item.theme}
                posterUrl={item.posterUrl}
                videoUrl={item.videoUrl}
                freePlay={item.freePlay}
                staticTotal={item.staticTotal}
                collectedIndexes={item.collectedIndexes}
                duplicateCount={item.duplicateCount}
                hideMeter={selected && detailsReady}
                onBuy={() => {
                  closeActive(item);
                  window.requestAnimationFrame(() => item.onBuy?.());
                }}
                onSelect={() => {
                  if (detailsTimer.current != null) {
                    window.clearTimeout(detailsTimer.current);
                    detailsTimer.current = null;
                  }
                  if (activeId !== item.id) {
                    setActiveId(item.id);
                    setDetailsReady(false);
                    setPhotoOpenSignal(0);
                    setPhotoOverlayOpen(false);
                    const locked = (item.state ?? "").startsWith("locked");
                    if (locked) {
                      onItemSelect?.(item.id, "locked-selected");
                    }
                    detailsTimer.current = window.setTimeout(() => {
                      setDetailsReady(true);
                      if (!locked) {
                        onItemSelect?.(item.id, "unlocked-selected");
                      }
                    }, DETAILS_DELAY * 1000);
                    return;
                  }
                  closeActive(item);
                }}
              />
            </m.div>
          );
        })}
      </div>

      <AnimatePresence>
        {active && activeCard ? (
          <m.div
            className="motion-card-holder__panel absolute top-0 right-0 z-[3]"
            style={{
              left: cardW + PANEL_GAP,
              height: cardH > 0 ? cardH : undefined,
            }}
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 16 }}
            transition={instant}
          >
            <div className="flex h-full min-h-0 w-full flex-col gap-2">
              <div className="motion-card-holder__head flex w-full shrink-0 items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <p className="static-carousel__title min-w-0 font-medium text-white">
                    {THEME_LABEL[activeCard.theme ?? "police"]} Motion Card
                  </p>
                  <p className="static-carousel__title shrink-0 font-medium text-white">
                    Nº {String(activeIndex + 1).padStart(2, "0")}/
                    {String(cards.length).padStart(2, "0")}
                  </p>
                </div>
                {(activeCard.state ?? "").startsWith("locked") ? null : (
                <div className="motion-card-holder__play w-full shrink-0" ref={playCtaRef}>
                    <CtaButton
                      {...SQUIRCLE_CTA}
                      fillParent
                      label=""
                      leadingIcon={
                        <>
                          {activeCard.freePlay ? null : (
                            <>
                              <DiamondLottie size={11} aria-hidden />
                              <span className="motion-card-play-cta__price">
                                {activeCard.playCost ?? packUnitCost()}
                              </span>
                            </>
                          )}
                          <span>{activeCard.freePlay ? "Free Play" : "Play Motion"}</span>
                          <Play
                            className="motion-card-play-cta__triangle"
                            size={11}
                            strokeWidth={2.4}
                            fill="currentColor"
                            aria-hidden
                          />
                        </>
                      }
                      costAmount={null}
                      fontSize={14}
                      cornerRadius={999}
                      aria-label={
                        activeCard.freePlay
                          ? "Free Play"
                          : `Play for ${activeCard.playCost ?? packUnitCost()} diamonds`
                      }
                      aria-expanded={activeCard.freePlay ? undefined : confirmPlay}
                      onClick={() => {
                        if (activeCard.freePlay) {
                          activeCard.onPlay?.();
                          return;
                        }
                        setConfirmPlay((open) => !open);
                      }}
                    />
                  {!activeCard.freePlay &&
                  confirmPlay &&
                  playCtaRef.current &&
                  !(activeCard.state ?? "").startsWith("locked") ? (
                    <PlayConfirm
                      anchor={playCtaRef.current}
                      playCost={activeCard.playCost ?? packUnitCost()}
                      onCancel={() => setConfirmPlay(false)}
                      onConfirm={() => {
                        setConfirmPlay(false);
                        activeCard.onPlay?.();
                      }}
                    />
                  ) : null}
                </div>
                )}
              </div>
              <PhotoGateway
                cards={gatewayCards(activeCard.photos?.length ? activeCard.photos : photos)}
                collected={(activeCard.collectedIndexes ?? []).length}
                total={activeCard.staticTotal ?? photos.length}
                quiet={photoOverlayOpen}
                onViewCollection={(event) => {
                  if (event.detail === 0) return;
                  setPhotoOpenSignal((signal) => signal + 1);
                }}
                className="h-auto min-h-0 max-w-none flex-1"
              />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
      {active && activeCard && photoOpenSignal > 0 ? (
        <StaticCarousel
          items={activeCard.photos?.length ? activeCard.photos : photos}
          theme={activeCard.theme}
          motionCardNumber={activeIndex + 1}
          motionCardTotal={cards.length}
          openSignal={photoOpenSignal}
          onExpandedChange={setPhotoOverlayOpen}
          overlayOnly
        />
      ) : null}
    </div>
  );
}
