import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type LockStatus = "locked" | "unlocked" | "min-unlocked";

type LockStatusBannerProps = {
  status?: LockStatus;
  className?: string;
};

function UnlockedGlyph() {
  const gradientId = `lock-unlocked-fill-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      width="9"
      height="12"
      viewBox="0 0 8.9043 11.2924"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block h-[11.3px] w-[8.9px] shrink-0"
    >
      <path
        d="M3.18652 0.282594C3.79086 0.00134637 4.45707 -0.0719938 5.09863 0.0716566C5.73998 0.215379 6.32914 0.569389 6.79102 1.08923C6.95894 1.2784 6.95847 1.58518 6.79004 1.77381C6.62158 1.96211 6.34863 1.96172 6.18066 1.77283C5.83922 1.38851 5.40384 1.12609 4.92969 1.0199C4.45564 0.913779 3.96414 0.968413 3.51758 1.17615C3.07092 1.38402 2.68912 1.73621 2.4209 2.18787C2.23319 2.50398 2.10839 2.85916 2.0498 3.22986H7.32422C7.74322 3.22986 8.14513 3.41773 8.44141 3.75037C8.73761 4.08299 8.9043 4.53392 8.9043 5.00427V9.51892C8.9043 9.98933 8.73767 10.4402 8.44141 10.7728C8.14513 11.1055 7.74322 11.2924 7.32422 11.2924H1.58008C1.16108 11.2924 0.759169 11.1055 0.462891 10.7728C0.16661 10.4402 0 9.98934 0 9.51892V5.00427C0 4.5339 0.166659 4.083 0.462891 3.75037C0.66061 3.52839 0.905464 3.37233 1.1709 3.29236C1.22977 2.70743 1.4113 2.14386 1.7041 1.65076C2.06685 1.0401 2.58263 0.563804 3.18652 0.282594ZM1.58008 4.19763C1.38971 4.19763 1.20692 4.28289 1.07227 4.43396C0.937593 4.58516 0.861328 4.79045 0.861328 5.00427V9.51892C0.861328 9.73275 0.937593 9.93804 1.07227 10.0892C1.20691 10.2402 1.38976 10.3256 1.58008 10.3256H7.32422C7.51456 10.3256 7.69738 10.2403 7.83203 10.0892C7.9667 9.93804 8.04297 9.73275 8.04297 9.51892V5.00427C8.04297 4.79045 7.9667 4.58516 7.83203 4.43396C7.69737 4.28286 7.51461 4.19763 7.32422 4.19763H1.58008ZM4.45215 6.13318C4.71876 6.13319 4.97456 6.25161 5.16309 6.46326C5.35155 6.67484 5.45694 6.96189 5.45703 7.26111C5.45703 7.56047 5.35163 7.84826 5.16309 8.05994C4.97457 8.27152 4.71871 8.39 4.45215 8.39002C4.18559 8.39002 3.92974 8.2715 3.74121 8.05994C3.55267 7.84826 3.44629 7.56047 3.44629 7.26111C3.44638 6.96189 3.55275 6.67484 3.74121 6.46326C3.92975 6.25163 4.18554 6.13318 4.45215 6.13318ZM4.45215 7.09998C4.41406 7.09998 4.37752 7.11759 4.35059 7.14783C4.32383 7.17796 4.30869 7.21857 4.30859 7.26111C4.30859 7.30385 4.32368 7.34513 4.35059 7.37537C4.37752 7.40561 4.41406 7.42322 4.45215 7.42322C4.49022 7.4232 4.52679 7.40559 4.55371 7.37537C4.58058 7.34514 4.5957 7.30382 4.5957 7.26111C4.59561 7.21859 4.58044 7.17795 4.55371 7.14783C4.52679 7.1176 4.49022 7.09999 4.45215 7.09998Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="4.45215"
          y1="0"
          x2="4.45215"
          y2="11.2924"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.326925" stopColor="#D9C694" />
          <stop offset="1" stopColor="#D9C694" stopOpacity="0.1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function LockedGlyph() {
  const gradientId = `lock-locked-fill-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      width="9"
      height="12"
      viewBox="0 0 9 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block h-3 w-[9px] shrink-0"
    >
      <path
        d="M1.05844 11.29C0.767367 11.29 0.518281 11.1848 0.31118 10.9744C0.10408 10.764 0.000352812 10.5108 0 10.2148V4.83857C0 4.54288 0.103727 4.28984 0.31118 4.07945C0.518634 3.86907 0.76772 3.76369 1.05844 3.76333H1.58766V2.6881C1.58766 1.94439 1.84574 1.31054 2.3619 0.786537C2.87807 0.262538 3.50202 0.00035878 4.23375 3.66975e-07C4.96548 -0.000358046 5.58961 0.261821 6.10612 0.786537C6.62264 1.31125 6.88055 1.94511 6.87984 2.6881V3.76333H7.40906C7.70013 3.76333 7.94939 3.86871 8.15685 4.07945C8.3643 4.2902 8.46785 4.54324 8.4675 4.83857V10.2148C8.4675 10.5105 8.36395 10.7637 8.15685 10.9744C7.94975 11.1852 7.70048 11.2904 7.40906 11.29H1.05844ZM1.05844 10.2148H7.40906V4.83857H1.05844V10.2148ZM4.98154 8.28578C5.18864 8.07575 5.29219 7.82272 5.29219 7.52667C5.29219 7.23062 5.18864 6.97758 4.98154 6.76755C4.77443 6.55752 4.52517 6.45215 4.23375 6.45143C3.94233 6.45071 3.69324 6.55609 3.48649 6.76755C3.27974 6.97901 3.17602 7.23205 3.17531 7.52667C3.17461 7.82128 3.27833 8.0745 3.48649 8.28632C3.69465 8.49814 3.94374 8.60334 4.23375 8.6019C4.52376 8.60047 4.77302 8.49474 4.98154 8.28578ZM2.64609 3.76333H5.82141V2.6881C5.82141 2.24008 5.66705 1.85927 5.35834 1.54566C5.04963 1.23204 4.67476 1.07524 4.23375 1.07524C3.79273 1.07524 3.41787 1.23204 3.10916 1.54566C2.80045 1.85927 2.64609 2.24008 2.64609 2.6881V3.76333Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="4.23375"
          y1="0"
          x2="4.23375"
          y2="11.29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.38" />
          <stop offset="0.745205" stopColor="white" stopOpacity="0.16" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
const LABEL_MOTION = {
  duration: 0.42,
  ease: APPLE_EASE,
};

/**
 * Figma 243:8741 — compact lock status pill.
 * Unlocked: champagne lock + label.
 * Locked: white lock + label.
 * min-unlocked: same Unlocked pill with the label clipped and slid away.
 */
export function LockStatusBanner({
  status = "unlocked",
  className,
}: LockStatusBannerProps) {
  const reduceMotion = useReducedMotion();
  const locked = status === "locked";
  const showLabel = status !== "min-unlocked";
  const label = locked ? "Locked" : "Unlocked";
  const instant = reduceMotion ? { duration: 0 } : undefined;

  return (
    <div
      className={[
        "inline-flex items-center overflow-hidden rounded-[30px] bg-black/50 px-2.5 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.08)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={status}
      aria-label={label}
    >
      <span className="inline-flex h-3 w-[9px] shrink-0 items-center justify-center">
        {locked ? <LockedGlyph /> : <UnlockedGlyph />}
      </span>

      <motion.div
        className="grid min-w-0"
        initial={false}
        animate={{
          gridTemplateColumns: showLabel ? "1fr" : "0fr",
          marginLeft: showLabel ? 8 : 0,
        }}
        transition={instant ?? LABEL_MOTION}
      >
        <div className="min-w-0 overflow-hidden">
          <span className="relative block whitespace-nowrap font-medium text-[10px] tracking-[0.2px]">
            <span className="invisible" aria-hidden="true">
              Unlocked
            </span>
            <motion.span
              className="absolute inset-0 text-white"
              initial={false}
              animate={{ x: showLabel ? "0%" : "-100%" }}
              transition={instant ?? LABEL_MOTION}
            >
              {label}
            </motion.span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
