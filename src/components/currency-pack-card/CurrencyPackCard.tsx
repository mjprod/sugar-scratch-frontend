import { Loader2 } from "lucide-react";
import { CtaButton } from "@/components/cta";
import "@/components/creator/mcp-photo-play-cta-css.css";
import { CoinLottie } from "@/components/ui/CoinLottie";
import {
  DIAMOND_MARK_PNG,
  DIAMOND_MARK_WEBP,
  DiamondLottie,
} from "@/components/ui/DiamondLottie";
import type { StoreBadge } from "@/services/store";
import "./CurrencyPackCard.css";

export type CurrencyPackCurrency = "diamonds" | "coins";

export type CurrencyPackCardProps = {
  currency: CurrencyPackCurrency;
  amount: number;
  priceLabel: string;
  badge?: StoreBadge | null;
  featured?: boolean;
  processing?: boolean;
  disabled?: boolean;
  /** Mount the center diamond Lottie. Off by default (carousel / memory). */
  iconsAnimated?: boolean;
  onBuy?: () => void;
  className?: string;
};

function badgeClassName(badge: StoreBadge): string {
  if (badge === "Popular") return "is-popular";
  if (badge === "Best Value") return "is-best";
  if (badge === "Bonus") return "is-bonus";
  return "";
}

/** Cash pack plate — purple Diamonds chrome; Coins = same structure, hue ~90°. */
export function CurrencyPackCard({
  currency,
  amount,
  priceLabel,
  badge = null,
  featured = false,
  processing = false,
  disabled = false,
  iconsAnimated = false,
  onBuy,
  className,
}: CurrencyPackCardProps) {
  const isCoins = currency === "coins";
  const amountLabel = amount.toLocaleString();
  const priceDisplay = priceLabel;
  const ariaPrice = isCoins
    ? `Swap ${priceDisplay} Coins for ${amountLabel} Diamonds`
    : `Buy ${amountLabel} Diamonds for ${priceDisplay}`;

  return (
    <article
      className={[
        "currency-pack-card",
        isCoins ? "is-coins" : "is-diamonds",
        featured ? "is-featured" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="currency-pack-card__frame">
        <div className="currency-pack-card__plate">
          <div className="currency-pack-card__well">
            {badge ? (
              <span
                className={["currency-pack-card__badge", badgeClassName(badge)]
                  .filter(Boolean)
                  .join(" ")}
              >
                {badge}
              </span>
            ) : null}
            <p className="currency-pack-card__kicker">
              {isCoins ? "Coin Swap" : "Diamond Pack"}
            </p>
            <span className="currency-pack-card__icon">
              {processing ? (
                <Loader2
                  className="size-10 animate-spin text-sky-200"
                  aria-hidden="true"
                />
              ) : (
                <>
                  <DiamondLottie
                    className="currency-pack-card__icon-mark is-side"
                    size={38}
                    animated={false}
                    aria-hidden
                  />
                  <DiamondLottie
                    className="currency-pack-card__icon-mark is-center"
                    /* Static WebP reads smaller than the Lottie fill — bump ~20% so the swap isn’t obvious. */
                    size={iconsAnimated ? 69 : Math.round(69 * 1.2)}
                    animated={iconsAnimated}
                    /* Coverflow lies to IntersectionObserver → blank canvas. */
                    freezeOnOffscreen={false}
                    /* Coverflow 3D changes client box → autoResize jumps the mark. */
                    autoResize={false}
                    aria-hidden
                  />
                  <DiamondLottie
                    className="currency-pack-card__icon-mark is-side"
                    size={38}
                    animated={false}
                    aria-hidden
                  />
                </>
              )}
            </span>
            <div className="currency-pack-card__amount-box">
              <p className="currency-pack-card__amount">
                {/* Plain still — never mounts Lottie (cluster above may animate). */}
                <picture className="currency-pack-card__amount-mark">
                  <source srcSet={DIAMOND_MARK_WEBP} type="image/webp" />
                  <img
                    src={DIAMOND_MARK_PNG}
                    alt=""
                    width={18}
                    height={18}
                    draggable={false}
                  />
                </picture>
                {amountLabel}
              </p>
            </div>
            <div className="currency-pack-card__buy">
              <CtaButton
                forceCss
                cssTone={isCoins ? "gold" : "purple"}
                fillParent
                type="button"
                label={processing ? "Processing…" : priceDisplay}
                leadingIcon={
                  !processing && isCoins ? (
                    <CoinLottie size={18} animated={false} aria-hidden />
                  ) : undefined
                }
                costAmount={null}
                cornerRadius={999}
                strokeWidth={1}
                disabled={disabled}
                aria-busy={processing}
                aria-label={ariaPrice}
                onClick={onBuy}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function DiamondPackCard(
  props: Omit<CurrencyPackCardProps, "currency">,
) {
  return <CurrencyPackCard {...props} currency="diamonds" />;
}

export function CoinPackCard(props: Omit<CurrencyPackCardProps, "currency">) {
  return <CurrencyPackCard {...props} currency="coins" />;
}
