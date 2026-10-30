/**
 * Currency-win is a real route so ScratchPrototype unmounts.
 * iOS keeps a hardware decoder per attached <video> — leaving the game
 * domain is what lets purgeRouteMemory blank src + load() and lose WebGL.
 */
import { Paths } from "../../../routes/Paths";
import {
  clearPendingMotionResult,
  finishMotionHand,
  loadGameSession,
  type GameSession,
} from "./gameSession";

export const MOTION_WIN_HOLD_MS = 7000;

export type MotionWinPayload = {
  coins: number;
  diamonds: number;
  current: number;
  total: number;
  resultId: string;
};

export function isMotionWinPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  return path === Paths.gameWin;
}

export function motionWinHref(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const q = params.toString();
  return q ? `${Paths.gameWin}?${q}` : Paths.gameWin;
}

export function motionWinPayloadFromPending(
  pending: GameSession["pendingMotionResult"] | null | undefined,
): MotionWinPayload | null {
  if (!pending) return null;
  const coins = Math.max(0, pending.coins ?? 0);
  const diamonds = Math.max(0, pending.diamonds ?? 0);
  if (pending.prize <= 0 || (coins <= 0 && diamonds <= 0)) return null;
  return {
    coins,
    diamonds,
    current: pending.current,
    total: pending.total,
    resultId: `${pending.cardId}:${coins}:${diamonds}:${pending.current}`,
  };
}

export function nextMotionCardId(session: GameSession): string | null {
  return (
    session.motionCardIds.find(
      (id) => !session.completedMotionIds.includes(id),
    ) ?? null
  );
}

/** After the win-page hold: next motion card, or the pack-fan hub. */
export async function resolveMotionWinExitHref(search: string): Promise<string> {
  clearPendingMotionResult();
  const session = loadGameSession();
  const nextId = session ? nextMotionCardId(session) : null;
  if (nextId) {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(raw);
    params.set("card", nextId);
    if (!params.get("game")) params.set("game", "1");
    return `${Paths.game}?${params.toString()}`;
  }
  await finishMotionHand();
  return Paths.game;
}
