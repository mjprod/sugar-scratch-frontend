import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { PlayConfirm } from "@/components/static-card/PlayConfirm";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import "./mcp-photo-play-cta-css.css";

const MOBILE_CTA_QUERY = "(max-width: 980px)";

type McpPhotoPlayCtaProps = {
  playPrice: number | null;
  freePlay?: boolean;
  ariaLabel: string;
  onPlay: () => void;
};

function useCssPhotoCta() {
  const [cssCta, setCssCta] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_CTA_QUERY).matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_CTA_QUERY);
    const sync = () => setCssCta(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return cssCta;
}

/**
 * Photo-grid play CTA + PlayConfirm.
 * Mobile: CSS plate (no BorderGlow / WebGL). Desktop: squircle CtaButton.
 * Free Play toggle → "Free ▶" (no diamond / price).
 */
export function McpPhotoPlayCta({
  playPrice,
  freePlay = false,
  ariaLabel,
  onPlay,
}: McpPhotoPlayCtaProps) {
  const cssCta = useCssPhotoCta();
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pendingPlayRef = useRef(false);
  const openedAtRef = useRef(0);
  const leaveDoneRef = useRef(false);
  const priced = playPrice != null;
  const showCost = priced && !freePlay;
  const showConfirm = showCost && (confirm || leaving);
  const resolvedAria = freePlay
    ? ariaLabel.replace(/^Play\b/, "Free Play").replace(/\s+for\s+\d+\s+diamonds$/i, "")
    : ariaLabel;

  function finishLeave() {
    if (leaveDoneRef.current) return;
    leaveDoneRef.current = true;
    const play = pendingPlayRef.current;
    pendingPlayRef.current = false;
    setConfirm(false);
    setLeaving(false);
    if (play) onPlay();
  }

  function dismiss(play: boolean) {
    leaveDoneRef.current = false;
    pendingPlayRef.current = play;
    setLeaving(true);
  }

  function activate() {
    if (freePlay || !priced) {
      onPlay();
      return;
    }
    if (leaving) return;
    if (confirm) {
      // iOS often synthesizes a second click ~300ms after the open tap.
      if (Date.now() - openedAtRef.current < 450) return;
      dismiss(false);
      return;
    }
    leaveDoneRef.current = false;
    openedAtRef.current = Date.now();
    setConfirm(true);
  }

  // Leave animation can fail to fire on iOS / reduced-motion — don't get stuck.
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(finishLeave, 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const expanded = showCost ? confirm || leaving : undefined;

  const freeLabel = (
    <span className="mcp-photo-play-cta-css__label mcp-photo-play-cta-css__free">
      Free
    </span>
  );

  const playIcon = (
    <Play
      className="mcp-photo-play-cta-css__play"
      size={16}
      strokeWidth={2.4}
      fill="currentColor"
      aria-hidden
    />
  );

  return (
    <div
      ref={setAnchorEl}
      className={[
        "mcp-photo-play-cta",
        freePlay ? "is-free-play" : priced ? "is-priced" : "is-owned",
        cssCta ? "is-css" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      {cssCta ? (
        <div className="mcp-photo-play-cta-css-wrap">
          <button
            type="button"
            className={[
              "mcp-photo-play-cta-css",
              freePlay ? "mcp-photo-play-cta-css--free" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={resolvedAria}
            aria-expanded={expanded}
            onClick={activate}
          >
            {freePlay ? (
              freeLabel
            ) : showCost ? (
              <>
                <DiamondLottie
                  className="mcp-photo-play-cta-css__diamond"
                  size={16}
                  aria-hidden
                />
                <span className="mcp-photo-play-cta-css__price">{playPrice}</span>
              </>
            ) : null}
            {playIcon}
          </button>
        </div>
      ) : (
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          fillParent
          label=""
          leadingIcon={
            <>
              {freePlay ? (
                <span className="mcp-photo-play-free">Free</span>
              ) : showCost ? (
                <>
                  <DiamondLottie
                    className="mcp-photo-play-diamond"
                    size={16}
                    aria-hidden
                  />
                  <span className="mcp-photo-play-price">{playPrice}</span>
                </>
              ) : null}
              <Play
                className="mcp-photo-play-triangle"
                size={16}
                strokeWidth={2.4}
                fill="currentColor"
                aria-hidden
              />
            </>
          }
          costAmount={null}
          fontSize={16}
          cornerRadius={999}
          aria-label={resolvedAria}
          aria-expanded={expanded}
          onClick={activate}
        />
      )}
      {showConfirm && anchorEl ? (
        <PlayConfirm
          anchor={anchorEl}
          playCost={playPrice}
          label="Play Photo Card?"
          leaving={leaving}
          onCancel={() => dismiss(false)}
          onConfirm={() => dismiss(true)}
          onLeaveEnd={finishLeave}
        />
      ) : null}
    </div>
  );
}
