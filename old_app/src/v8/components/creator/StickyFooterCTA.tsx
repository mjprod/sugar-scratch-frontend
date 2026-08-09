import type { StickyCtaMode, ThemeCardData, ThemeDetailData } from "../../flow/collection";
import { scratchReadyCount } from "../../flow/collection";

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
        <button type="button" className="cpv2-cta-primary cpv2-cta-full" onClick={onScratch}>
          Scratch Now
        </button>
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
          <button type="button" className="cpv2-cta-primary" onClick={onOpenPack}>
            Open Pack
          </button>
          <button type="button" className="cpv2-cta-secondary" onClick={onBuy}>
            Buy another for 💎{buyCost}
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
        <button type="button" className="cpv2-cta-primary cpv2-cta-full" onClick={onBuy}>
          Buy Theme Pack ◆{buyCost}
        </button>
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
        <button type="button" className="cpv2-cta-primary cpv2-cta-full" onClick={onClaim}>
          Claim Reward
        </button>
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
      <button type="button" className="cpv2-cta-primary cpv2-cta-full" onClick={onView}>
        View Collection
      </button>
    </div>
  );
}
