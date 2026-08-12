import { Lock, Play } from "lucide-react";
import type { CardConfig } from "@/features/collection/lib/cards";

export function ThemeMotionDetail({
  themeName,
  cards,
  loading,
  onSelectCard,
}: {
  themeName: string;
  cards: CardConfig[];
  loading?: boolean;
  onSelectCard: (card: CardConfig) => void;
}) {
  return (
    <div className="cpv2-theme-detail">
      <header className="cpv2-theme-header">
        <div className="cpv2-theme-header-title">
          <h3 className="cpv2-theme-name">{themeName}</h3>
          <strong className="cpv2-progress-pct">
            {cards.length} motion
          </strong>
        </div>
        <p className="cpv2-theme-series">Tap a motion card to open the featured view</p>
      </header>

      <div className="cpv2-cards-layout">
        <div className="cpv2-motion-block" id="cpv2-motion-cards">
          <div className="cpv2-block-head">
            <h4>Motion Cards</h4>
            <span>{cards.length}</span>
          </div>
          {loading && cards.length === 0 ? (
            <p className="cpv2-reveal-hint">Loading cards…</p>
          ) : cards.length === 0 ? (
            <p className="cpv2-reveal-hint">No cards yet for this theme</p>
          ) : (
            <div className="cpv2-motion-row">
              {cards.map((card) => {
                const unlocked = (card.videoCardCount ?? 0) > 0 || Boolean(card.mediaUrl);
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={[
                      "cpv2-motion-cell",
                      unlocked ? "is-unlocked" : "is-locked",
                    ].join(" ")}
                    onClick={() => onSelectCard(card)}
                    aria-label={card.name}
                  >
                    {card.mediaUrl ? (
                      card.mediaType === "video" ? (
                        <video
                          src={card.mediaUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="cpv2-motion-thumb"
                        />
                      ) : (
                        <img
                          src={card.mediaUrl}
                          alt=""
                          className="cpv2-motion-thumb"
                        />
                      )
                    ) : (
                      <span className="cpv2-motion-placeholder" />
                    )}
                    <span className="cpv2-motion-label">{card.name}</span>
                    <span className="cpv2-motion-icon" aria-hidden>
                      {unlocked ? (
                        <Play className="size-3.5" />
                      ) : (
                        <Lock className="size-3.5" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
