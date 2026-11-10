import { useMemo, type CSSProperties } from "react";
import {
  collectionProgressFromBoard,
  type CreatorBoard,
} from "@/services/creatorBoard";
import type { ThemeCardData } from "@/services/collection";

export function CreatorProgressPanel({
  themes,
  board,
  showPersonalProgress,
  loading,
  onThemeClick,
}: {
  themes: ThemeCardData[];
  board?: CreatorBoard | null;
  showPersonalProgress: boolean;
  loading?: boolean;
  onThemeClick?: (themeId: string) => void;
}) {
  const progressByTheme = useMemo(() => {
    const map = new Map<string, { owned: number; total: number }>();
    for (const theme of board?.themes ?? []) {
      const motionDone = theme.motionCards.filter(
        (card) => card.status === "unlocked",
      ).length;
      const staticDone = theme.motionCards.reduce(
        (sum, card) =>
          sum +
          Math.max(
            card.staticCards.filter((slot) => slot.owned).length,
            card.staticCardsOwned,
          ),
        0,
      );
      const staticTotal = theme.motionCards.reduce(
        (sum, card) => sum + (card.staticCardsTotal || card.staticCards.length),
        0,
      );
      // One Premium motion card per theme, even when the board still sends null.
      map.set(theme.id, {
        owned: motionDone + staticDone + (theme.premium?.unlocked ? 1 : 0),
        total: theme.motionCards.length + staticTotal + 1,
      });
    }
    return map;
  }, [board]);

  const boardProgress = useMemo(
    () => collectionProgressFromBoard(board),
    [board],
  );

  const themeProgress = (theme: ThemeCardData) => {
    const fromBoard = progressByTheme.get(theme.id);
    if (fromBoard) return fromBoard;
    // Board is the player's collection. Catalog photo URLs are not owned cards.
    if (board) return { owned: 0, total: theme.total };
    return { owned: theme.collected, total: theme.total };
  };

  const totalCollected = board
    ? boardProgress.owned
    : themes.reduce((sum, theme) => sum + theme.collected, 0);
  const totalCards = board
    ? boardProgress.total
    : themes.reduce((sum, theme) => sum + theme.total, 0);
  const totalPct = board
    ? boardProgress.pct
    : totalCards > 0
      ? Math.min(100, Math.round((totalCollected / totalCards) * 100))
      : 0;

  const widestProgressLabel = useMemo(() => {
    let widest = "";
    for (const theme of themes) {
      if (theme.name.length > widest.length) widest = theme.name;
    }
    return widest;
  }, [themes]);

  return (
    <div
      className="cpv2-progress-panel cpv2-enter"
      style={{ "--cpv2-enter-i": 0 } as CSSProperties}
      role="region"
      aria-label="Collection progress"
    >
      <h2 className="cpv2-progress-title">Collection Progress</h2>
      <ul className="cpv2-progress-list">
        <li className="cpv2-progress-themes">
          <ul
            className="cpv2-progress-grid"
            style={
              widestProgressLabel
                ? {
                    ["--cpv2-progress-widest" as string]:
                      JSON.stringify(widestProgressLabel),
                  }
                : undefined
            }
          >
            {loading && (themes.length === 0 || showPersonalProgress)
              ? Array.from(
                  { length: Math.max(4, themes.length || 0) },
                  (_, i) => (
                    <li
                      key={`sk-${themes[i]?.id ?? i}`}
                      className="cpv2-progress-row is-skeleton"
                    />
                  ),
                )
              : themes.map((theme, i) => {
                  const progress = themeProgress(theme);
                  const pct =
                    progress.total > 0
                      ? Math.min(
                          100,
                          Math.round((progress.owned / progress.total) * 100),
                        )
                      : 0;
                  const shown = showPersonalProgress ? pct : 0;
                  const cells = (
                    <>
                      <span className="cpv2-progress-label">{theme.name}</span>
                      <div
                        className="cpv2-progress-track"
                        role="progressbar"
                        aria-valuenow={shown}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${theme.name}, ${showPersonalProgress ? progress.owned : 0} of ${progress.total}`}
                      >
                        <span
                          className="cpv2-progress-fill"
                          style={
                            {
                              "--cpv2-progress": `${shown}%`,
                            } as CSSProperties
                          }
                        />
                      </div>
                      <span className="cpv2-progress-value">{shown}%</span>
                    </>
                  );
                  return (
                    <li
                      key={theme.id}
                      className="cpv2-progress-row"
                      style={{ "--cpv2-i": i } as CSSProperties}
                    >
                      {onThemeClick ? (
                        <button
                          type="button"
                          className="cpv2-progress-row-hit"
                          onClick={() => onThemeClick(theme.id)}
                        >
                          {cells}
                        </button>
                      ) : (
                        cells
                      )}
                    </li>
                  );
                })}
          </ul>
        </li>
        <li
          className="cpv2-progress-row is-total"
          style={{ "--cpv2-i": themes.length } as CSSProperties}
        >
          <span className="cpv2-progress-label">Total</span>
          <div
            className="cpv2-progress-track"
            role="progressbar"
            aria-valuenow={showPersonalProgress ? totalPct : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Total, ${showPersonalProgress ? totalCollected : 0} of ${totalCards}`}
          >
            <span
              className="cpv2-progress-fill"
              style={
                {
                  "--cpv2-progress": `${showPersonalProgress ? totalPct : 0}%`,
                } as CSSProperties
              }
            />
          </div>
          <span className="cpv2-progress-value">
            {showPersonalProgress ? totalPct : 0}%
          </span>
        </li>
      </ul>
    </div>
  );
}
