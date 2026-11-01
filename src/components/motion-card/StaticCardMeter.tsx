import "./MotionCard.css";

export type StaticCardMeterProps = {
  /** First tick: champagne when the motion card is unlocked. */
  motionUnlocked?: boolean;
  /** Include the leading motion-unlock tick. Default true. */
  includeMotionTick?: boolean;
  /** Number of static cards tied to this motion card. Default 10. */
  staticTotal?: number;
  /** Indexes (0-based) of static cards played / unlocked / bought at least once. */
  collectedIndexes?: number[];
  className?: string;
};

const STATIC_LOCKED = "rgba(64,64,64,0.82)";

/**
 * Figma 229:3123 — 11 ticks under a motion tile.
 * Tick 0 = motion unlock. The rest = associated static cards.
 */
export function StaticCardMeter({
  motionUnlocked = false,
  includeMotionTick = true,
  staticTotal = 10,
  collectedIndexes = [],
  className,
}: StaticCardMeterProps) {
  const collected = new Set(collectedIndexes);

  return (
    <div
      className={[
        "flex items-center justify-center gap-[2px]",
        className ?? "h-[13px] w-[92px]",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {includeMotionTick ? (
        <span
          className={[
            "scm-tick h-full min-w-px flex-1 rounded-[2px]",
            motionUnlocked ? "scm-tick--motion" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            motionUnlocked ? undefined : { background: STATIC_LOCKED }
          }
        />
      ) : null}
      {Array.from({ length: staticTotal }, (_, index) => (
        <span
          key={index}
          className={[
            "scm-tick h-full min-w-px flex-1 rounded-[2px]",
            collected.has(index) ? "scm-tick--collected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            collected.has(index)
              ? undefined
              : { background: STATIC_LOCKED }
          }
        />
      ))}
    </div>
  );
}
