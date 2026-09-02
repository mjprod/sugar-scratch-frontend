import { useRef } from "react";
import { motion, type PanInfo } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { lottieRenderConfig } from "@/utils/lottieRender";

const TEAR_DRAG_DISTANCE_PX = 180;

export function DragToTearControl({
  percent,
  finishing,
  onScrub,
}: {
  percent: number;
  finishing: boolean;
  onScrub: (percent: number, options?: { snapClosed?: boolean }) => void;
}) {
  const originPercentRef = useRef(percent);
  const torn = finishing || percent >= 100;
  const boxOpacity = torn ? 0 : 1 - Math.min(100, Math.max(0, percent)) / 100;

  return (
    <div className="pointer-events-none flex justify-center">
      <motion.button
        type="button"
        data-tutorial-target="tear"
        aria-label="Drag to tear"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        animate={{ opacity: boxOpacity, x: 0 }}
        transition={{ duration: torn ? 0.2 : 0 }}
        style={{ pointerEvents: torn ? "none" : "auto", x: 0 }}
        onDragStart={() => {
          originPercentRef.current = percent;
        }}
        onDrag={(_, info: PanInfo) => {
          const next =
            originPercentRef.current + (info.offset.x / TEAR_DRAG_DISTANCE_PX) * 100;
          onScrub(next);
        }}
        onDragEnd={(_, info: PanInfo) => {
          const next =
            originPercentRef.current + (info.offset.x / TEAR_DRAG_DISTANCE_PX) * 100;
          onScrub(next, { snapClosed: true });
        }}
        className="pointer-events-auto flex h-[6.3rem] w-[28rem] cursor-ew-resize items-center justify-center overflow-hidden bg-transparent p-0"
      >
        <DotLottieReact
          src="/lottie/iconSwipe.lottie"
          autoplay
          loop
          speed={1}
          renderConfig={lottieRenderConfig()}
          style={{ width: 288, height: 288 }}
        />
      </motion.button>
    </div>
  );
}
