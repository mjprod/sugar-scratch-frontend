import { apiMutate } from "@/lib/api";
import { recordRevealedCards } from "@/services/collectionState";
import {
  getReadyToScratch,
  trackScratchEvent,
  upsertReadyToScratch,
} from "@/services/readyToScratch";
import {
  loadGameCatalog,
  pickWonPhotocards,
  type ThemedMotionCard,
} from "./session";

export const GAME_SESSION_KEY = "sugar_scratchie_game_v1";

export type GameSessionPhase =
  | "motion"
  | "photo_reveal"
  | "photo"
  | "done";

export type GameSessionSource = {
  sourcePackId?: string;
  sourceCreator?: string;
  sourcePackName?: string;
};

export type GameSession = {
  version: 1;
  phase: GameSessionPhase;
  /** Dealt motion card ids (unique themes), play order. */
  motionCardIds: string[];
  themes: string[];
  /** Model id for the first card (URL convenience). */
  modelId: string;
  completedMotionIds: string[];
  /** Accumulated photo-scratch prizes from motion match games. */
  photoPrizeTotal: number;
  /** Random photocards awarded after the motion hand. */
  wonPhotoIds: string[];
  completedPhotoIds: string[];
  /** Accumulated diamonds from photo match games. */
  diamondTotal: number;
  /** True after diamondTotal has been applied to the app wallet. */
  walletCredited: boolean;
  /** Ready-to-Scratch pack this run was launched from, if any. */
  sourcePackId?: string;
  sourceCreator?: string;
  sourcePackName?: string;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isGameSession(value: unknown): value is GameSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.phase === "string" &&
    Array.isArray(v.motionCardIds) &&
    Array.isArray(v.themes) &&
    typeof v.modelId === "string" &&
    Array.isArray(v.completedMotionIds) &&
    typeof v.photoPrizeTotal === "number" &&
    Array.isArray(v.wonPhotoIds) &&
    Array.isArray(v.completedPhotoIds) &&
    typeof v.diamondTotal === "number" &&
    // Older sessions omit the field; reject corrupted non-booleans.
    (v.walletCredited === undefined || typeof v.walletCredited === "boolean") &&
    (v.sourcePackId === undefined || typeof v.sourcePackId === "string") &&
    (v.sourceCreator === undefined || typeof v.sourceCreator === "string") &&
    (v.sourcePackName === undefined || typeof v.sourcePackName === "string")
  );
}

function normalizeGameSession(session: GameSession): GameSession {
  return {
    ...session,
    walletCredited: session.walletCredited === true,
    sourcePackId: optionalString(session.sourcePackId),
    sourceCreator: optionalString(session.sourceCreator),
    sourcePackName: optionalString(session.sourcePackName),
  };
}

function readStoredRaw(): string | null {
  try {
    const live = sessionStorage.getItem(GAME_SESSION_KEY);
    if (live) return live;
  } catch {
    /* private mode */
  }
  try {
    return localStorage.getItem(GAME_SESSION_KEY);
  } catch {
    return null;
  }
}

function parseStoredSession(raw: string | null): GameSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGameSession(parsed) ? normalizeGameSession(parsed) : null;
  } catch {
    return null;
  }
}

export function loadGameSession(): GameSession | null {
  if (typeof window === "undefined") return null;
  return parseStoredSession(readStoredRaw());
}

export function saveGameSession(session: GameSession): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  try {
    sessionStorage.setItem(GAME_SESSION_KEY, raw);
  } catch {
    // Ignore quota / private mode.
  }
  try {
    localStorage.setItem(GAME_SESSION_KEY, raw);
  } catch {
    // Ignore quota / private mode.
  }
  void apiMutate("/api/me/game-session", {
    method: "PUT",
    body: raw,
  }).catch(() => undefined);
}

export function clearGameSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(GAME_SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(GAME_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function isGameModeUrl(search = window.location.search): boolean {
  return new URLSearchParams(search).get("game") === "1";
}

export function startMotionSession(
  hand: ThemedMotionCard[],
  source?: GameSessionSource,
): GameSession {
  const first = hand[0];
  const session: GameSession = {
    version: 1,
    phase: "motion",
    motionCardIds: hand.map((card) => card.id),
    themes: hand.map((card) => card.theme),
    modelId: first?.model_id?.trim() || "",
    completedMotionIds: [],
    photoPrizeTotal: 0,
    wonPhotoIds: [],
    completedPhotoIds: [],
    diamondTotal: 0,
    walletCredited: false,
    sourcePackId: optionalString(source?.sourcePackId),
    sourceCreator: optionalString(source?.sourceCreator),
    sourcePackName: optionalString(source?.sourcePackName),
  };
  saveGameSession(session);
  return session;
}

export function sessionMatchesPack(
  session: GameSession | null | undefined,
  packId: string,
  instanceId?: string | null,
): boolean {
  const sourceId = session?.sourcePackId;
  if (!sourceId) return false;
  return sourceId === packId || (Boolean(instanceId) && sourceId === instanceId);
}

/**
 * Mark the Ready-to-Scratch pack this run came from as fully revealed.
 * Idempotent: a missing or already-cleared pack is a no-op.
 */
export function completeSourcePack(
  session: GameSession | null | undefined,
): boolean {
  const packId = optionalString(session?.sourcePackId);
  if (!packId) return false;
  const pack = getReadyToScratch(packId);
  if (!pack) return false;
  const allIds = pack.session.cards.map((card) => card.id);
  const fresh = allIds.filter((id) => !pack.revealed.includes(id));
  upsertReadyToScratch({
    packId: pack.packId,
    packName: pack.packName,
    creator: pack.creator,
    creatorId: pack.creatorId,
    session: pack.session,
    revealed: allIds,
    coverUrl: pack.coverUrl,
    themeName: pack.themeName,
  });
  if (fresh.length > 0) {
    recordRevealedCards({
      count: fresh.length,
      creatorId: pack.creatorId,
      creatorName: pack.creator,
    });
  }
  trackScratchEvent("All Cards Revealed", { packId });
  return true;
}

/** Mark diamondTotal as applied to the wallet (idempotent). */
export function markWalletCredited(): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  if (session.walletCredited) return session;
  const next: GameSession = { ...session, walletCredited: true };
  saveGameSession(next);
  return next;
}

/** First motion card in deal order that has not been scratched yet. */
export function firstMissingMotionCardId(session: GameSession): string | undefined {
  return session.motionCardIds.find(
    (id) => !session.completedMotionIds.includes(id),
  );
}

/** Theme label for a motion card in the session hand (parallel arrays). */
export function themeForMotionCard(
  session: GameSession,
  cardId: string,
): string | undefined {
  const index = session.motionCardIds.indexOf(cardId);
  if (index < 0) return undefined;
  return session.themes[index];
}

export function motionPlayHref(session: GameSession, cardId?: string): string {
  const id = cardId ?? firstMissingMotionCardId(session) ?? session.motionCardIds[0] ?? "";
  const params = new URLSearchParams();
  if (session.modelId) params.set("model", session.modelId);
  if (id) params.set("card", id);
  params.set("game", "1");
  return `/game?${params.toString()}`;
}

export function firstMissingPhotoCardId(session: GameSession): string | undefined {
  return session.wonPhotoIds.find(
    (id) => !session.completedPhotoIds.includes(id),
  );
}

export function photoPlayHref(session: GameSession, cardId?: string): string {
  const id =
    cardId ?? firstMissingPhotoCardId(session) ?? session.wonPhotoIds[0] ?? "";
  const params = new URLSearchParams();
  if (id) params.set("card", id);
  params.set("game", "1");
  return `/photo-scratch?${params.toString()}`;
}

/** Record a finished motion card and its photo-scratch prize units. */
export function recordMotionCardResult(
  cardId: string,
  prize: number,
): GameSession | null {
  const session = loadGameSession();
  if (!session || session.phase !== "motion") return session;
  if (session.completedMotionIds.includes(cardId)) return session;
  const next: GameSession = {
    ...session,
    completedMotionIds: [...session.completedMotionIds, cardId],
    photoPrizeTotal: session.photoPrizeTotal + Math.max(0, prize),
  };
  saveGameSession(next);
  return next;
}

/** After all motion cards: pick random photocards and move to reveal. */
export async function finishMotionHand(): Promise<GameSession | null> {
  const session = loadGameSession();
  if (!session) return null;
  if (session.phase !== "motion") return session;

  const catalog = await loadGameCatalog();
  const won = pickWonPhotocards(
    catalog.photos,
    session.photoPrizeTotal,
    session.themes,
  );
  const next: GameSession = {
    ...session,
    phase: "photo_reveal",
    wonPhotoIds: won.map((photo) => photo.id),
  };
  saveGameSession(next);
  return next;
}

export function beginPhotoPhase(): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  if (session.phase !== "photo_reveal" && session.phase !== "photo") {
    return session;
  }
  const next: GameSession = { ...session, phase: "photo" };
  saveGameSession(next);
  return next;
}

export function recordPhotoCardResult(
  cardId: string,
  diamonds: number,
): GameSession | null {
  const session = loadGameSession();
  if (!session || session.phase !== "photo") return session;
  if (session.completedPhotoIds.includes(cardId)) return session;
  const next: GameSession = {
    ...session,
    completedPhotoIds: [...session.completedPhotoIds, cardId],
    diamondTotal: session.diamondTotal + Math.max(0, diamonds),
  };
  saveGameSession(next);
  return next;
}

export function finishPhotoHand(): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  const next: GameSession = { ...session, phase: "done" };
  saveGameSession(next);
  return next;
}

type GameNavigateFn = (to: string) => void;

let gameNavigate: GameNavigateFn | null = null;

/** Wire react-router's navigate from AppShell so AudioContext survives SPA hops. */
export function bindGameNavigate(fn: GameNavigateFn | null): void {
  gameNavigate = fn;
}

/**
 * In-app navigation. Must stay on the same document (no full reload) so a
 * Safari AudioContext unlocked on Play/Continue survives into the next
 * scratch screen.
 */
export function navigateTo(href: string): void {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.assign(href);
    return;
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (gameNavigate) {
    gameNavigate(next);
    window.scrollTo(0, 0);
    return;
  }
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.pushState(null, "", next);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
