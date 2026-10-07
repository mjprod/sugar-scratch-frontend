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

const MOTION_UNLOCKED = "#e8c19c";
const STATIC_LOCKED = "rgba(64,64,64,0.82)";
const STATIC_COLLECTED = "#d4145a";

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
          className="h-full min-w-px flex-1 rounded-[2px]"
          style={{
            background: motionUnlocked ? MOTION_UNLOCKED : STATIC_LOCKED,
          }}
        />
      ) : null}
      {Array.from({ length: staticTotal }, (_, index) => (
        <span
          key={index}
          className="h-full min-w-px flex-1 rounded-[2px]"
          style={{
            background: collected.has(index)
              ? STATIC_COLLECTED
              : STATIC_LOCKED,
          }}
        />
      ))}
    </div>
  );
}
