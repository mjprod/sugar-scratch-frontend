import { useEffect, useRef } from "react";
import { Lock, Package, Play } from "lucide-react";
import type {
  MotionCardSlot,
  PhotoCardSlot,
  ThemeDetailData,
} from "@/services/collection";

/** Themes that have already played the progress fill animation this session. */
const animatedProgressThemes = new Set<string>();

export function SelectedThemeDetail({
  detail,
  collected,
  total,
  onOpenPackShortcut,
  onToast,
}: {
  detail: ThemeDetailData;
  collected: number;
  total: number;
  onOpenPackShortcut: () => void;
  onToast: (message: string) => void;
}) {
  const remaining = Math.max(0, total - collected);
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
  const photoUnlocked = detail.photoCards.filter((card) => card.isUnlocked).length;
  const motionUnlocked = detail.motionCards.filter((card) => card.isUnlocked).length;
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const already = animatedProgressThemes.has(detail.themeId);
    if (already) {
      bar.style.transition = "none";
      bar.style.width = `${pct}%`;
      return;
    }
    animatedProgressThemes.add(detail.themeId);
    bar.style.transition = "none";
    bar.style.width = "0%";
    requestAnimationFrame(() => {
      bar.style.transition = "width 420ms cubic-bezier(0.22, 1, 0.36, 1)";
      bar.style.width = `${pct}%`;
    });
  }, [pct, detail.themeId]);

  const packLine =
    detail.unopenedPacks > 0
      ? `${detail.unopenedPacks} unopened pack${
          detail.unopenedPacks === 1 ? "" : "s"
        } available`
      : null;

  return (
    <div className="cpv2-theme-detail">
      <header className="cpv2-theme-header">
        <div className="cpv2-theme-header-title">
          <h3 className="cpv2-theme-name">{detail.themeName}</h3>
          <strong className="cpv2-progress-pct">{pct}%</strong>
        </div>
        <p className="cpv2-theme-series">{detail.seriesLabel}</p>
        <p className="cpv2-theme-counts">
          {collected} / {total} collected
          <span className="cpv2-summary-sep" aria-hidden="true">
            ·
          </span>
          {remaining} remaining
        </p>
        <div
          className="cpv2-progress-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${detail.themeName} completion`}
        >
          <div ref={barRef} />
        </div>
        {packLine ? (
          <button
            type="button"
            className="cpv2-theme-pack-line"
            onClick={onOpenPackShortcut}
          >
            <Package className="size-3.5" aria-hidden="true" />
            {packLine}
          </button>
        ) : null}
      </header>

      <div className="cpv2-cards-layout">
        <div className="cpv2-motion-block" id="cpv2-motion-cards">
          <div className="cpv2-block-head">
            <h4>Motion Cards</h4>
            <span>
              {motionUnlocked} / {detail.motionCards.length}
            </span>
          </div>
          <div className="cpv2-motion-row">
            {detail.motionCards.map((card) => (
              <MotionCell
                key={card.index}
                card={card}
                onClick={() =>
                  onToast(
                    card.isUnlocked
                      ? `Preview ${card.label}`
                      : "Unlock this Motion Card by collecting more cards from this Theme.",
                  )
                }
              />
            ))}
          </div>
        </div>

        <div className="cpv2-photo-block" id="cpv2-photo-cards">
          <div className="cpv2-block-head">
            <h4>Photo Cards</h4>
            <span>
              {photoUnlocked} / {detail.photoCards.length}
            </span>
          </div>
          <div className="cpv2-photo-grid">
            {detail.photoCards.map((card) => (
              <PhotoCell
                key={card.index}
                card={card}
                packName={detail.packName}
                onClick={() =>
                  onToast(
                    card.isUnlocked
                      ? `P${String(card.index).padStart(2, "0")} · ${card.rarity ?? "Rare"}`
                      : `P${String(card.index).padStart(2, "0")} · Available in ${detail.packName}`,
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MotionCell({
  card,
  onClick,
}: {
  card: MotionCardSlot;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={["cpv2-motion-card", card.isUnlocked ? "is-unlocked" : "is-locked"].join(" ")}
      onClick={onClick}
      aria-label={
        card.isUnlocked
          ? `${card.label}, unlocked, preview`
          : `${card.label}, locked`
      }
    >
      <div className="cpv2-motion-media">
        {card.thumbnailUrl ? (
          <img
            src={card.thumbnailUrl}
            alt=""
            className={[
              "size-full object-cover",
              card.isUnlocked ? "" : "cpv2-locked-blur",
            ].join(" ")}
          />
        ) : (
          <div className="cpv2-locked-fill">
            <Lock className="size-4" />
          </div>
        )}
        {card.isUnlocked ? (
          <span className="cpv2-play" aria-hidden="true">
            <Play className="size-4 fill-white" />
          </span>
        ) : (
          <span className="cpv2-lock-badge" aria-hidden="true">
            <Lock className="size-3.5" />
          </span>
        )}
        {card.isNew && card.isUnlocked ? (
          <span className="cpv2-new-badge">NEW</span>
        ) : null}
        <span className="cpv2-card-num">{card.label}</span>
        <span className="cpv2-motion-state">
          {card.isUnlocked ? "Unlocked" : "Locked"}
        </span>
      </div>
    </button>
  );
}

function PhotoCell({
  card,
  packName,
  onClick,
}: {
  card: PhotoCardSlot;
  packName: string;
  onClick: () => void;
}) {
  const num = `P${String(card.index).padStart(2, "0")}`;
  return (
    <button
      type="button"
      className={["cpv2-photo-card", card.isUnlocked ? "is-collected" : "is-locked"].join(" ")}
      onClick={onClick}
      aria-label={
        card.isUnlocked
          ? `${num}, ${card.rarity ?? "Rare"}, collected`
          : `${num}, not collected, available in ${packName}`
      }
    >
      {card.thumbnailUrl ? (
        <img
          src={card.thumbnailUrl}
          alt=""
          className={[
            "size-full object-cover",
            card.isUnlocked ? "" : "cpv2-locked-blur",
          ].join(" ")}
        />
      ) : (
        <div className="cpv2-locked-fill">
          <Lock className="size-3.5" />
        </div>
      )}
      {!card.isUnlocked ? (
        <span className="cpv2-lock-badge" aria-hidden="true">
          <Lock className="size-3" />
        </span>
      ) : null}
      <span className="cpv2-card-num">{num}</span>
      {card.isUnlocked && card.rarity ? (
        <span className="cpv2-photo-rarity">{card.rarity}</span>
      ) : null}
      {!card.isUnlocked ? (
        <span className="cpv2-photo-missing">Not Collected</span>
      ) : null}
      {card.isNew && card.isUnlocked ? (
        <span className="cpv2-new-badge">NEW</span>
      ) : null}
      {card.duplicates && card.duplicates > 1 ? (
        <span className="cpv2-dupe-badge">×{card.duplicates}</span>
      ) : null}
    </button>
  );
}
