import Aurora from "@/components/cta/Aurora";

const HERO_ART = "/images/store/get-diamonds-hero.webp";

export function GetDiamondsHeroVisual() {
  return (
    <div className="get-diamonds-hero__visual">
      <Aurora
        className="get-diamonds-hero__aurora"
        colorStops={["#5b0a72", "#d91e6e", "#ff94b4", "#3b0764"]}
        amplitude={0.85}
        blend={0.62}
        speed={0.55}
        bandHeight={1.35}
        rotation={18}
        particleCount={14}
        particleSize={0.028}
        particleSpeed={0.75}
        particleOpacity={0.55}
        particleColor="#ffd4ec"
        particleTwinkle={0.65}
      />
      <img
        className="get-diamonds-hero__art-img"
        src={HERO_ART}
        alt=""
        loading="eager"
        decoding="async"
      />
      <span className="get-diamonds-hero__sheen" aria-hidden="true" />
    </div>
  );
}
