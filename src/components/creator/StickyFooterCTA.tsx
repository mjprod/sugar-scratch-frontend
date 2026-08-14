import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { DiamondLottie } from "@/components/ui/DiamondLottie";
import type { StickyCtaMode, ThemeCardData, ThemeDetailData } from "@/services/collection";
import { scratchReadyCount } from "@/services/collection";

function PrimaryCta({
  label,
  onClick,
  costAmount = null,
  full = true,
}: {
  label: string;
  onClick: () => void;
  costAmount?: string | number | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "cpv2-cta-primary cpv2-cta-full" : "cpv2-cta-primary"}>
      <CtaButton
        {...ctaButtonPropsFromTemplate("squircleCTA")}
        fillParent
        type="button"
        label={label}
        costAmount={costAmount}
        fontSize={14}
        strokeWidth={1}
        onClick={onClick}
      />
    </div>
  );
}

export function StickyFooterCTA({
  mode,
  theme,
  detail,
  diamonds,
  buyCost = 10,
  onScratch,
  onOpenPack,
  onBuy,
  onView,
  onClaim,
}: {
  mode: StickyCtaMode;
  theme: ThemeCardData;
  detail: ThemeDetailData;
  diamonds: number;
  buyCost?: number;
  onScratch: () => void;
  onOpenPack: () => void;
  onBuy: () => void;
  onView: () => void;
  onClaim: () => void;
}) {
  if (!mode) return null;

  if (mode === "scratch") {
    const count = scratchReadyCount(detail);
    return (
      <div className="cpv2-sticky-cta">
        <div className="cpv2-sticky-row">
          <div className="cpv2-sticky-thumb">
            <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
          </div>
          <div className="cpv2-sticky-copy">
            <p className="cpv2-sticky-title">
              {count} scratch {count === 1 ? "card" : "cards"} ready
            </p>
            <p className="cpv2-sticky-meta">Reveal your collected cards</p>
          </div>
        </div>
        <PrimaryCta label="Scratch Now" onClick={onScratch} />
      </div>
    );
  }

  if (mode === "open-pack") {
    return (
      <div className="cpv2-sticky-cta">
        <div className="cpv2-sticky-row">
          <div className="cpv2-sticky-thumb">
            <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
          </div>
          <div className="cpv2-sticky-copy">
            <p className="cpv2-sticky-title">
              {detail.unopenedPacks} unopened pack
              {detail.unopenedPacks === 1 ? "" : "s"} ready
            </p>
            <p className="cpv2-sticky-meta">No additional cost</p>
          </div>
        </div>
        <div className="cpv2-sticky-actions">
          <PrimaryCta label="Open Pack" onClick={onOpenPack} full={false} />
          <button type="button" className="cpv2-cta-secondary" onClick={onBuy}>
            Buy another for{" "}
            <DiamondLottie size="1em" className="cpv2-cta-diamond" />
            {buyCost}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "buy-theme-pack") {
    return (
      <div className="cpv2-sticky-cta">
        <div className="cpv2-sticky-row">
          <div className="cpv2-sticky-thumb">
            <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
          </div>
          <div className="cpv2-sticky-copy">
            <p className="cpv2-sticky-title">Complete {theme.name}</p>
            <p className="cpv2-sticky-meta">{diamonds} ◆ available</p>
          </div>
        </div>
        <PrimaryCta
          label="Buy Theme Pack"
          costAmount={buyCost}
          onClick={onBuy}
        />
      </div>
    );
  }

  if (mode === "claim") {
    return (
      <div className="cpv2-sticky-cta">
        <div className="cpv2-sticky-row">
          <div className="cpv2-sticky-thumb">
            <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
          </div>
          <div className="cpv2-sticky-copy">
            <p className="cpv2-sticky-title">Theme reward ready</p>
            <p className="cpv2-sticky-meta">{theme.name} is complete</p>
          </div>
        </div>
        <PrimaryCta label="Claim Reward" onClick={onClaim} />
      </div>
    );
  }

  return (
    <div className="cpv2-sticky-cta">
      <div className="cpv2-sticky-row">
        <div className="cpv2-sticky-thumb">
          <img src={theme.thumbnailUrl} alt="" className="size-full object-cover" />
        </div>
        <div className="cpv2-sticky-copy">
          <p className="cpv2-sticky-title">Collection complete</p>
          <p className="cpv2-sticky-meta">{theme.name}</p>
        </div>
      </div>
      <PrimaryCta label="View My Collection" onClick={onView} />
    </div>
  );
}
