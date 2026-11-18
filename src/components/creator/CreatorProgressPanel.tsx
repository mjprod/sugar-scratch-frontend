import { useMemo, type CSSProperties } from "react";
import {
  collectionProgressFromBoard,
  themeCollectionProgressFromBoard,
  type CreatorBoard,
} from "@/services/creatorBoard";
import type { ThemeCardData } from "@/services/collection";

function ProgressRow({
  label,
  owned,
  total,
  showPersonalProgress,
  index,
  valueMode,
  isTotal,
}: {
  label: string;
  owned: number;
  total: number;
  showPersonalProgress: boolean;
  index: number;
  valueMode: "pct" | "count";
  isTotal?: boolean;
}) {
  const shownOwned = showPersonalProgress ? owned : 0;
  const pct =
    total > 0 ? Math.min(100, Math.round((shownOwned / total) * 100)) : 0;
  const value =
    valueMode === "count" ? `${shownOwned}/${total}` : `${pct}%`;

  return (
    <li
      className={["cpv2-progress-row", isTotal ? "is-total" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ "--cpv2-i": index } as CSSProperties}
    >
      <span className="cpv2-progress-label">{label}</span>
      <div
        className="cpv2-progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}, ${shownOwned} of ${total}`}
      >
        <span
          className="cpv2-progress-fill"
          style={{ "--cpv2-progress": `${pct}%` } as CSSProperties}
        />
      </div>
      <span className="cpv2-progress-value">{value}</span>
    </li>
  );
}

export function CreatorProgressPanel({
  themes,
  board,
  showPersonalProgress,
  loading,
  onThemeClick,
  showTotal = true,
  variant = "collection",
}: {
  themes: ThemeCardData[];
  board?: CreatorBoard | null;
  showPersonalProgress: boolean;
  loading?: boolean;
  onThemeClick?: (themeId: string) => void;
  /** Profile shows Total; ignored when variant is theme. */
  showTotal?: boolean;
  /** Theme page: Motion / Photo / Total for the single theme. */
  variant?: "collection" | "theme";
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

  const themeId = themes[0]?.id ?? "";
  const themeBreakdown = useMemo(
    () => themeCollectionProgressFromBoard(board, themeId),
    [board, themeId],
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
    if (variant === "theme") return "Motion";
    let widest = "";
    for (const theme of themes) {
      if (theme.name.length > widest.length) widest = theme.name;
    }
    return widest;
  }, [themes, variant]);

  const themeRows = useMemo(() => {
    if (variant !== "theme") return null;
    const catalog = themes[0];
    const totalOwned = board
      ? themeBreakdown.owned
      : showPersonalProgress
        ? (catalog?.collected ?? 0)
        : 0;
    const totalTotal = board
      ? themeBreakdown.total
      : (catalog?.total ?? 0);
    return [
      {
        label: "Motion",
        owned: themeBreakdown.motionOwned,
        total: themeBreakdown.motionTotal,
      },
      {
        label: "Photo",
        owned: themeBreakdown.photoOwned,
        total: themeBreakdown.photoTotal,
      },
      {
        label: "Total",
        owned: totalOwned,
        total: totalTotal,
        isTotal: true as const,
      },
    ];
  }, [board, showPersonalProgress, themeBreakdown, themes, variant]);

  return (
    <div
      className="cpv2-progress-panel cpv2-enter"
      style={{ "--cpv2-enter-i": 0 } as CSSProperties}
      role="region"
      aria-label={
        variant === "theme" && themes[0]?.name
          ? `${themes[0].name} progress`
          : "Collection progress"
      }
    >
      <h2 className="cpv2-progress-title">
        {variant === "theme" && themes[0]?.name
          ? `${themes[0].name} Progress`
          : "Collection Progress"}
      </h2>
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
            {loading && (themes.length === 0 || showPersonalProgress) ? (
              Array.from(
                {
                  length:
                    variant === "theme"
                      ? 3
                      : Math.max(4, themes.length || 0),
                },
                (_, i) => (
                  <li
                    key={`sk-${themes[i]?.id ?? i}`}
                    className="cpv2-progress-row is-skeleton"
                  />
                ),
              )
            ) : variant === "theme" && themeRows ? (
              themeRows.map((row, i) => (
                <ProgressRow
                  key={row.label}
                  label={row.label}
                  owned={row.owned}
                  total={row.total}
                  showPersonalProgress={showPersonalProgress}
                  index={i}
                  valueMode="count"
                  isTotal={row.isTotal}
                />
              ))
            ) : (
              themes.map((theme, i) => {
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
              })
            )}
          </ul>
        </li>
        {variant === "collection" && showTotal ? (
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
        ) : null}
      </ul>
    </div>
  );
}
