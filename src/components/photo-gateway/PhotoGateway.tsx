import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import "./PhotoGateway.css";

export type PhotoGatewayCard = {
  id: string;
  backgroundUrl: string;
  topLayerUrl?: string;
  alt?: string;
};

type PhotoGatewayProps = {
  cards: PhotoGatewayCard[];
  /** First line, e.g. "Unlock Teacher Nº 02/03". */
  heading?: string;
  /** Collected static cards for this theme. */
  collected?: number;
  /** Static cards available for this theme. */
  total?: number;
  onViewCollection?: () => void;
  /** Overlay is open: drop scatter decodes and the live CTA shader. */
  quiet?: boolean;
  className?: string;
};

type ScatterPose = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
};

/** Desktop scatter, as a fraction of the gateway box. */
const DESKTOP_SCATTER: ScatterPose[] = [
  { x: 0, y: 0, rotate: 15, scale: 1.26 },
  { x: 0.76, y: 0.02, rotate: -13, scale: 1.5 },
  { x: 0.04, y: 0.54, rotate: -23, scale: 1.42 },
  { x: 0.72, y: 0.52, rotate: 11, scale: 1.42 },
];

/** Tuned on a 193px-wide mobile panel. Scaled to the live gateway width. */
const MOBILE_BASE_WIDTH = 193;
const MOBILE_SCATTER: ScatterPose[] = [
  { x: -14, y: -14, rotate: 27, scale: 0.96 },
  { x: 160, y: -13, rotate: -19, scale: 0.92 },
  { x: -4, y: 96, rotate: -20, scale: 0.94 },
  { x: 152, y: 90, rotate: 9, scale: 1 },
];

const VIEW_COLLECTION_CTA = ctaButtonPropsFromTemplate("squircleCTA");
const MOBILE_MQ = "(max-width: 980px)";

function subscribeMobile(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(MOBILE_MQ);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_MQ).matches,
    () => false,
  );
}

function poseStyle(pose: ScatterPose, width: number, height: number, mobile: boolean) {
  const left = mobile ? (pose.x / MOBILE_BASE_WIDTH) * width : pose.x * width;
  const top = mobile ? pose.y : pose.y * height;
  return {
    left,
    top,
    transform: `rotate(${pose.rotate}deg) scale(${pose.scale})`,
  };
}

/**
 * Rounded gateway into a creator's photo cards.
 * Catalog stills sit scattered behind the label and collection CTA.
 */
export function PhotoGateway({
  cards,
  heading,
  collected = 0,
  total = 0,
  onViewCollection,
  quiet = false,
  className,
}: PhotoGatewayProps) {
  const mobile = useIsMobile();
  const started = collected > 0;
  const label = started ? `View all (${collected}/${total})` : "Start Playing";
  const rootRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [mobileWidth, setMobileWidth] = useState(96);
  const [box, setBox] = useState({ width: MOBILE_BASE_WIDTH, height: 138 });

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => {
      const next = node.getBoundingClientRect();
      if (next.width > 0) {
        setBox({ width: next.width, height: next.height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!mobile) return;
    const title = copyRef.current?.querySelector(".cta-button__title");
    if (!title) return;
    const next = Math.ceil(title.getBoundingClientRect().width + 48);
    if (next > 0) setMobileWidth(next);
  }, [mobile, label]);

  const scattered = useMemo(() => {
    const poses = mobile ? MOBILE_SCATTER : DESKTOP_SCATTER;
    return cards.slice(0, poses.length).map((card, index) => ({
      card,
      pose: poses[index]!,
    }));
  }, [cards, mobile]);

  return (
    <div
      ref={rootRef}
      className={[
        "photo-gateway relative isolate h-[220px] w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.16_0.02_350)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {quiet
          ? null
          : scattered.map(({ card, pose }) => {
          const top = card.topLayerUrl?.trim() || "";
          return (
            <div
              key={card.id}
              className="photo-gateway__scatter absolute h-[118px] w-[78px] overflow-hidden rounded-lg shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              style={poseStyle(pose, box.width, box.height, mobile)}
            >
              <img
                src={card.backgroundUrl}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
              {top ? (
                <img
                  src={top}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : null}
            </div>
          );
        })}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      <div className="relative z-10 flex h-full min-w-0 items-center justify-center px-3">
        <div
          ref={copyRef}
          className="photo-gateway__copy flex w-full min-w-0 flex-col items-center gap-4"
        >
          <p className="photo-gateway__title text-center font-semibold tracking-tight text-white">
            {heading ? (
              <>
                {heading}
                <br />
                Photo Cards
              </>
            ) : (
              "Photo Cards"
            )}
          </p>
          <div
            className="photo-gateway__cta h-12 max-w-full"
            style={{ width: mobile ? mobileWidth : 220 }}
          >
            <CtaButton
              {...VIEW_COLLECTION_CTA}
              label={label}
              costAmount={null}
              fillParent
              fontSize={mobile ? 14 : 15}
              auroraPaused={quiet}
              onClick={onViewCollection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
