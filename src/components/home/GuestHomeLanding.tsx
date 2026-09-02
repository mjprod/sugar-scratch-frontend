import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { Paths } from "@/routes/Paths";
import { useMarkPageReady } from "@/shared/ui/PageTransition";

const GUEST_HOME_VIDEO = "/video/homepagevideo-min.mp4";

export function GuestHomeLanding() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canPlay, setCanPlay] = useState(false);

  useMarkPageReady(canPlay);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const markCanPlay = () => setCanPlay(true);
    video.addEventListener("canplay", markCanPlay);
    video.addEventListener("playing", markCanPlay);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      video.pause();
      setCanPlay(true);
      return () => {
        video.removeEventListener("canplay", markCanPlay);
        video.removeEventListener("playing", markCanPlay);
      };
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    const play = video.play();
    if (play && typeof play.catch === "function") {
      void play.catch(() => {
        setCanPlay(true);
      });
    }

    if (video.readyState >= 3) setCanPlay(true);

    const fallback = window.setTimeout(() => setCanPlay(true), 2500);

    return () => {
      window.clearTimeout(fallback);
      video.removeEventListener("canplay", markCanPlay);
      video.removeEventListener("playing", markCanPlay);
    };
  }, []);

  return (
    <section className="guest-home-landing" aria-label="Welcome">
      <video
        ref={videoRef}
        className="guest-home-landing__video"
        src={GUEST_HOME_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        aria-hidden
      />
      <div className="guest-home-landing__scrim" aria-hidden />
      <div className="guest-home-landing__cta">
        <CtaButton
          {...ctaButtonPropsFromTemplate("squircleCTA")}
          label="Get Started FREE"
          costAmount={null}
          onClick={() => navigate(Paths.discover)}
        />
      </div>
    </section>
  );
}
