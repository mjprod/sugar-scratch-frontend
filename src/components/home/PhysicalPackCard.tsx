import type { CSSProperties } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { formatCountdown, type FeaturedPack } from "@/services/homepage";

/**
 * Featured Pack Carousel — physical foil wrapper (Spec 1.0)
 * + Homepage 3.0 rarity / badge treatments.
 */
export function PhysicalPackCard({
  pack,
  active,
  onOpen,
}: {
  pack: FeaturedPack;
  active: boolean;
  onOpen: () => void;
}) {
  const countdown = pack.isLimited ? formatCountdown(pack.expiresAt) : null;
  const ended = countdown === "ENDED";
  const canOpen = pack.isAvailable && !ended;
  const titleLines = pack.packTitle.split("\n").slice(0, 3);
  const rarity = pack.rarity ?? "rare";

  const a11y = [
    `${pack.packTitle.replace(/\n/g, " ")} by ${pack.creatorName}.`,
    pack.isLimited ? "Limited pack." : null,
    pack.isNew ? "New pack." : null,
    pack.isHot ? "Hot pack." : null,
    pack.isTrending ? "Trending pack." : null,
    canOpen
      ? `Open pack for ${pack.diamondCost} diamonds.`
      : "Pack unavailable.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={[
        "physical-pack",
        active ? "is-active" : "is-adjacent",
        `rarity-${rarity}`,
      ].join(" ")}
      aria-hidden={!active}
      aria-current={active ? "true" : undefined}
      aria-label={active ? a11y : undefined}
      style={
        {
          "--pack-primary": pack.accentColors.primary,
          "--pack-secondary": pack.accentColors.secondary,
          "--pack-glow": pack.accentColors.glow,
        } as CSSProperties
      }
    >
      <div className="physical-pack-glow" aria-hidden="true" />

      <div className="physical-pack-shell">
        <div
          className="physical-pack-art"
          style={{ backgroundImage: `url(${pack.coverImageUrl})` }}
          role="img"
          aria-label={active ? `${pack.creatorName} pack artwork` : undefined}
        />
        <div className="physical-pack-readability" aria-hidden="true" />
        <div className="physical-pack-foil" aria-hidden="true" />
        <div className="physical-pack-seal physical-pack-seal-top" aria-hidden="true" />
        <div className="physical-pack-seal physical-pack-seal-bottom" aria-hidden="true" />
        <div className="physical-pack-wrinkles" aria-hidden="true">
          <svg className="physical-pack-wrinkle-svg" viewBox="0 0 100 160" preserveAspectRatio="none">
            <path
              d="M2 12 C6 40, 1 70, 5 95 S2 140, 4 152"
              fill="none"
              stroke="rgba(255,180,220,0.35)"
              strokeWidth="1.2"
            />
            <path
              d="M7 18 C3 50, 9 80, 4 110 S8 145, 6 155"
              fill="none"
              stroke="rgba(255,220,170,0.22)"
              strokeWidth="0.8"
            />
            <path
              d="M98 14 C94 42, 99 72, 95 98 S98 138, 96 150"
              fill="none"
              stroke="rgba(255,200,120,0.32)"
              strokeWidth="1.2"
            />
            <path
              d="M93 20 C97 52, 91 82, 96 112 S92 142, 94 154"
              fill="none"
              stroke="rgba(255,230,190,0.2)"
              strokeWidth="0.8"
            />
          </svg>
        </div>
        <div className="physical-pack-edge-light" aria-hidden="true" />
        <div className="physical-pack-shimmer" aria-hidden="true" />

        {active ? (
          <div className="physical-pack-badges">
            {pack.isNew ? <span className="physical-pack-badge-new">NEW</span> : null}
            {pack.isHot && !pack.isNew ? (
              <span className="physical-pack-badge-hot">HOT</span>
            ) : null}
            {pack.isTrending && !pack.isLimited ? (
              <span className="physical-pack-badge-trend">TRENDING</span>
            ) : null}
            {pack.isLimited ? (
              <div className="physical-pack-badge-limited">
                <span>LIMITED</span>
                {countdown ? (
                  <span className="physical-pack-countdown">{countdown}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {active ? (
          <div className="physical-pack-content">
            <h2 className="physical-pack-title">
              {titleLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h2>
            <p className="physical-pack-collection">{pack.collectionName}</p>
            <p className="physical-pack-meta">
              {pack.creatorName} · {pack.themeName}
            </p>

            <div className="open-pack-btn">
              <CtaButton
                {...ctaButtonPropsFromTemplate("squircleCTA")}
                fillParent
                label="Open Pack"
                costAmount={pack.diamondCost}
                fontSize={15}
                disabled={!canOpen}
                aria-label={
                  canOpen
                    ? `Open pack for ${pack.diamondCost} diamonds`
                    : "Pack unavailable"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
