import "../gameHub.css";

/** Four-point Sugar sparkle, pinched at the waist. */
function sparklePath(cx: number, cy: number, r: number) {
  return [
    `M${cx} ${cy - r}`,
    `Q${cx} ${cy} ${cx + r} ${cy}`,
    `Q${cx} ${cy} ${cx} ${cy + r}`,
    `Q${cx} ${cy} ${cx - r} ${cy}`,
    `Q${cx} ${cy} ${cx} ${cy - r}`,
    "Z",
  ].join("");
}

const SPARKLES = [
  { cx: 38, cy: 62, r: 9, delay: "0s" },
  { cx: 176, cy: 84, r: 6.5, delay: "1.1s" },
  { cx: 38, cy: 166, r: 6, delay: "2.2s" },
  { cx: 166, cy: 160, r: 5, delay: "1.7s" },
];

/** Opened pack with nothing inside — playful, never a failure symbol. */
function EmptyPackIllustration() {
  return (
    <svg
      className="pack-no-match__art"
      viewBox="0 0 210 210"
      role="img"
      aria-label="An opened pack with nothing inside"
    >
      <defs>
        <linearGradient
          id="pack-no-match-edge"
          gradientUnits="userSpaceOnUse"
          x1="40"
          y1="20"
          x2="180"
          y2="190"
        >
          <stop offset="0%" stopColor="#F49BD2" />
          <stop offset="60%" stopColor="#D98BE8" />
          <stop offset="100%" stopColor="#A98BFF" />
        </linearGradient>
      </defs>

      <rect
        className="pack-no-match__lid"
        x="54"
        y="28"
        width="102"
        height="24"
        rx="9"
      />
      <rect
        className="pack-no-match__body"
        x="56"
        y="68"
        width="98"
        height="108"
        rx="14"
      />
      <path className="pack-no-match__mouth" d="M56 90 H154" />

      <text className="pack-no-match__wordmark" x="105" y="128">
        SUGAR
      </text>
      <path
        className="pack-no-match__heart"
        d="M105 158c-9-6.5-15-11.5-15-17.5a8.5 8.5 0 0 1 15-4.2 8.5 8.5 0 0 1 15 4.2c0 6-6 11-15 17.5Z"
      />

      {SPARKLES.map((s) => (
        <path
          key={`${s.cx}-${s.cy}`}
          className="pack-no-match__sparkle"
          d={sparklePath(s.cx, s.cy, s.r)}
          style={{ animationDelay: s.delay }}
        />
      ))}
    </svg>
  );
}

type PackNoMatchResultProps = {
  /** What came up empty — photo cards from the pack, or diamonds from the hand. */
  subtitle?: string;
};

/**
 * Pack finished with nothing to show for it. The pack-opening still completed —
 * this reads the empty result as an outcome, not as a lost reward.
 */
export function PackNoMatchResult({
  subtitle = "No Photo Cards this pack.",
}: PackNoMatchResultProps) {
  return (
    <div className="pack-no-match">
      <p className="pack-no-match__kicker">Pack Complete</p>
      <h1 className="pack-no-match__title">
        <span className="pack-no-match__title-highlight">Oops!</span> Nothing
        Matched
      </h1>
      <p className="pack-no-match__subtitle">{subtitle}</p>

      <EmptyPackIllustration />

      <div className="pack-no-match__note">
        <span className="pack-no-match__note-spark" aria-hidden="true">
          ✦
        </span>
        <p>
          <span className="pack-no-match__note-lead">Don&rsquo;t worry,</span>{" "}
          better luck next time!
        </p>
      </div>
    </div>
  );
}
