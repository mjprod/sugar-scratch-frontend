import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CoinLottie } from "@/components/ui/CoinLottie";
import { openDeferredLotties } from "@/lib/lottie/DeferredLottie";
import { LpBuildShell } from "@/pages/lp-build/LpBuildShell";
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
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  return (
    <div className={className ? `lp-build-pack ${className}` : "lp-build-pack"}>
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

export function LpBuildPage2() {
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
    <LpBuildShell>
      <div className="lp-build-hero">
        <div className="lp-build-copy-wrap">
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
          <div className="lp-build-pack-stack">
            <PackFace
              src={face.src}
              poster={face.poster}
              className="lp-build-pack--back"
            />
            <PackFace
              src={face.src}
              poster={face.poster}
              className="lp-build-pack--front"
            />
          </div>
        ) : null}
        <div className="lp-build-headline glass glass-strength-50 glass-chromatic-50 glass-blur-1 glass-saturation-150 glass-brightness-50 glass-surface">
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
      <p className="lp-build-scroll-hint">or scroll down to find out more</p>
    </LpBuildShell>
  );
}
