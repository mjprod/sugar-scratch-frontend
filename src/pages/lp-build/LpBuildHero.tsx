import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { openDeferredLotties } from "@/lib/lottie/DeferredLottie";
import { foilsFromModel, loadModels } from "@/services/models";

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function PackFace({
  src,
  poster,
  className,
  style,
}: {
  src: string;
  poster?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className ? `lp-build-pack ${className}` : "lp-build-pack"}
      style={style}
    >
      {poster ? (
        <img
          className="lp-build-pack-poster"
          src={poster}
          alt=""
          draggable={false}
        />
      ) : null}
      <video
        className="lp-build-pack-video"
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
      />
    </div>
  );
}

export function LpBuildHero({
  showScrollHint = false,
  hintOpacity = 1,
  parallax = 0,
}: {
  showScrollHint?: boolean;
  hintOpacity?: number;
  parallax?: number;
}) {
  const [searchParams] = useSearchParams();
  const modelId =
    searchParams.get("model")?.trim() ||
    searchParams.get("username")?.trim() ||
    "julianaval";
  const username = toTitleCase(
    searchParams.get("username")?.trim() || modelId || "Hey",
  );
  const [face, setFace] = useState<{ src: string; poster?: string } | null>(
    null,
  );

  useEffect(() => {
    openDeferredLotties();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadModels().then((models) => {
      if (cancelled) return;
      const model =
        models.find((entry) => entry.id?.trim() === modelId) ??
        models.find(
          (entry) =>
            (entry.id ?? "").toLowerCase() === modelId.toLowerCase(),
        );
      const foil = model ? foilsFromModel(model)[0] : null;
      if (!foil?.videoUrl) return;
      setFace({ src: foil.videoUrl, poster: foil.posterUrl });
    });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  return (
    <>
      <div className="lp-build-hero">
        <div
          className="lp-build-copy-wrap"
          style={{ transform: `translate3d(0, ${-parallax * 0.22}px, 0)` }}
        >
          <img
            src="/svg/scratchHeartBg.svg"
            alt=""
            className="lp-build-copy-heart"
            aria-hidden="true"
            draggable={false}
          />
          <p className="lp-build-copy">
            <span className="lp-build-username">{username}</span> we're building
            a Sugar Scratch game for fans like yours.{" "}
            <span>We'd love to put you in the game!</span>
          </p>
        </div>
        {face ? (
          <div
            className="lp-build-pack-stack"
            style={{ opacity: Math.max(0, 1 - parallax / 420) }}
          >
            <PackFace
              src={face.src}
              poster={face.poster}
              className="lp-build-pack--back"
              style={{
                transform: `translate(-50%, -50%) translateX(${10 - (parallax / 420) * 10}%) rotate(${9 - (parallax / 420) * 9}deg)`,
              }}
            />
            <PackFace
              src={face.src}
              poster={face.poster}
              className="lp-build-pack--front"
              style={{
                transform: `translate(0, 0) translateX(${-15 + (parallax / 420) * 15}%) rotate(${-9 + (parallax / 420) * 9}deg)`,
              }}
            />
          </div>
        ) : null}
        <div
          className="lp-build-headline glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-50 glass-surface"
          style={{ transform: `translate3d(0, ${-parallax * 0.55}px, 0)` }}
        >
          <CoinLottie
            className="lp-build-headline-coin lp-build-headline-coin--tr"
            size={75}
          />
          <CoinLottie className="lp-build-headline-coin lp-build-headline-coin--bl" size={60} />
          Scratch{" "}
          <span className="lp-build-headline-play">
            <img
              src="/svg/squiggle.svg"
              alt=""
              className="lp-build-headline-squiggle"
              aria-hidden="true"
              draggable={false}
            />
            <span className="lp-build-headline-play-text">to Play</span>
          </span>
          <br />
          Sugar in your Bank
          <p className="lp-build-subhead">
            Your fans scratch. <span>You earn money.</span>
          </p>
        </div>
      </div>
      {showScrollHint ? (
        <p
          className="lp-build-scroll-hint"
          style={{ opacity: hintOpacity }}
        >
          or scroll down to find out more
        </p>
      ) : null}
    </>
  );
}
