import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { lottieRenderConfig } from "@/utils/lottieRender";
import "./PhotoGateway.css";

export const PHOTO_SCRATCH_TEXT_SRC = "/lottie/lottiePhotoScratchText.lottie";

export type PhotoGatewayCard = {
  id: string;
  backgroundUrl: string;
  topLayerUrl?: string;
  alt?: string;
};

type PhotoGatewayProps = {
  cards: PhotoGatewayCard[];
  /** Collected static cards for this theme. */
  collected?: number;
  /** Static cards available for this theme. */
  total?: number;
  onViewCollection?: (event: MouseEvent<HTMLButtonElement>) => void;
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

export function PhotoCountBadge({ collected, total }: { collected: number; total: number }) {
  return (
    <div className="photo-gateway__badge" aria-label={`${collected} of ${total} photo cards`}>
      <svg aria-hidden="true" viewBox="0 0 8.9043 11.2924" fill="none">
        <path
          d="M3.18652 0.282594C3.79086 0.00134637 4.45707 -0.0719938 5.09863 0.0716566C5.73998 0.215379 6.32914 0.569389 6.79102 1.08923C6.95894 1.2784 6.95847 1.58518 6.79004 1.77381C6.62158 1.96211 6.34863 1.96172 6.18066 1.77283C5.83922 1.38851 5.40384 1.12609 4.92969 1.0199C4.45564 0.913779 3.96414 0.968413 3.51758 1.17615C3.07092 1.38402 2.68912 1.73621 2.4209 2.18787C2.23319 2.50398 2.10839 2.85916 2.0498 3.22986H7.32422C7.74322 3.22986 8.14513 3.41773 8.44141 3.75037C8.73761 4.08299 8.9043 4.53392 8.9043 5.00427V9.51892C8.9043 9.98933 8.73767 10.4402 8.44141 10.7728C8.14513 11.1055 7.74322 11.2924 7.32422 11.2924H1.58008C1.16108 11.2924 0.759169 11.1055 0.462891 10.7728C0.16661 10.4402 0 9.98934 0 9.51892V5.00427C0 4.5339 0.166659 4.083 0.462891 3.75037C0.66061 3.52839 0.905464 3.37233 1.1709 3.29236C1.22977 2.70743 1.4113 2.14386 1.7041 1.65076C2.06685 1.0401 2.58263 0.563804 3.18652 0.282594ZM1.58008 4.19763C1.38971 4.19763 1.20692 4.28289 1.07227 4.43396C0.937593 4.58516 0.861328 4.79045 0.861328 5.00427V9.51892C0.861328 9.73275 0.937593 9.93804 1.07227 10.0892C1.20691 10.2402 1.38976 10.3256 1.58008 10.3256H7.32422C7.51456 10.3256 7.69738 10.2403 7.83203 10.0892C7.9667 9.93804 8.04297 9.73275 8.04297 9.51892V5.00427C8.04297 4.79045 7.9667 4.58516 7.83203 4.43396C7.69737 4.28286 7.51461 4.19763 7.32422 4.19763H1.58008ZM4.45215 6.13318C4.71876 6.13319 4.97456 6.25161 5.16309 6.46326C5.35155 6.67484 5.45694 6.96189 5.45703 7.26111C5.45703 7.56047 5.35163 7.84826 5.16309 8.05994C4.97457 8.27152 4.71871 8.39 4.45215 8.39002C4.18559 8.39002 3.92974 8.2715 3.74121 8.05994C3.55267 7.84826 3.44629 7.56047 3.44629 7.26111C3.44638 6.96189 3.55275 6.67484 3.74121 6.46326C3.92975 6.25163 4.18554 6.13318 4.45215 6.13318ZM4.45215 7.09998C4.41406 7.09998 4.37752 7.11759 4.35059 7.14783C4.32383 7.17796 4.30869 7.21857 4.30859 7.26111C4.30859 7.30385 4.32368 7.34513 4.35059 7.37537C4.37752 7.40561 4.41406 7.42322 4.45215 7.42322C4.49022 7.4232 4.52679 7.40559 4.55371 7.37537C4.58058 7.34514 4.5957 7.30382 4.5957 7.26111C4.59561 7.21859 4.58044 7.17795 4.55371 7.14783C4.52679 7.1176 4.49022 7.09999 4.45215 7.09998Z"
          fill="#fff"
        />
      </svg>
      <span>
        {collected}/{total}
      </span>
    </div>
  );
}
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
  collected = 0,
  total = 0,
  onViewCollection,
  quiet = false,
  className,
}: PhotoGatewayProps) {
  const mobile = useIsMobile();
  const label = collected > 0 ? "View all" : "Start Playing";
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
      <PhotoCountBadge collected={collected} total={total} />
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
          <div className="photo-gateway__title" aria-hidden="true">
            <DotLottieReact
              src={PHOTO_SCRATCH_TEXT_SRC}
              autoplay
              loop={false}
              renderConfig={lottieRenderConfig()}
            />
          </div>
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
              onClick={(event) => onViewCollection?.(event)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
