import { apiMutate } from "@/lib/api";
import { upsertReadyToScratch } from "@/services/readyToScratch";
import type { OpeningSession } from "@/services/purchase";
import {
  loadGameCatalog,
  pickWonPhotocards,
  type ThemedMotionCard,
} from "./session";

export type PackScratchLink = {
  readyPackId: string;
  packName: string;
  creator: string;
  coverUrl?: string;
  themeName?: string;
  openingSession: OpeningSession;
  /** Opening fan card id per motion card (parallel to motionCardIds). */
  openingCardIds: string[];
  /** Opening ids already written to collection ledger (fan scratch or motion settle). */
  settledOpeningIds: string[];
};

export const GAME_SESSION_KEY = "sugar_scratchie_game_v1";

export type GameSessionPhase =
  | "motion"
  | "photo_reveal"
  | "photo"
  | "done";

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
  /** Set when motion play continues a pack opening from PurchaseFlow. */
  packScratch?: PackScratchLink;
  /** Photo Cards awarded by the Motion Card that just completed. */
  lastMotionWinPhotoIds?: string[];
  /** Result overlay waiting for Scratch Next / Save Remaining / photo summary. */
  pendingMotionResult?: {
    cardId: string;
    photoIds: string[];
    prize: number;
    current: number;
    total: number;
  };
};

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
    (v.walletCredited === undefined || typeof v.walletCredited === "boolean")
  );
}

function normalizeGameSession(session: GameSession): GameSession {
  return {
    ...session,
    walletCredited: session.walletCredited === true,
  };
}

function readStoredSession(storage: Storage): GameSession | null {
  try {
    const raw = storage.getItem(GAME_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameSession(parsed) ? normalizeGameSession(parsed) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(storage: Storage, session: GameSession): void {
  try {
    storage.setItem(GAME_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota / private mode.
  }
}

export function loadGameSession(): GameSession | null {
  if (typeof window === "undefined") return null;
  const fromSession = readStoredSession(window.sessionStorage);
  if (fromSession) return fromSession;
  return readStoredSession(window.localStorage);
}

export function saveGameSession(session: GameSession): void {
  if (typeof window === "undefined") return;
  writeStoredSession(window.sessionStorage, session);
  writeStoredSession(window.localStorage, session);
  void apiMutate("/api/me/game-session", {
    method: "PUT",
    body: JSON.stringify(session),
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

/** Keep opened-pack Ready to Scratch in sync with the live game session. */
export function persistPackScratchInventory(session: GameSession): void {
  const link = session.packScratch;
  if (!link) return;
  upsertReadyToScratch({
    packId: link.readyPackId,
    packName: link.packName,
    creator: link.creator,
    session: link.openingSession,
    revealed: link.settledOpeningIds,
    coverUrl: link.coverUrl,
    themeName: link.themeName,
  });
}

export function persistGameProgress(): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  saveGameSession(session);
  persistPackScratchInventory(session);
  return session;
}

export function isGameModeUrl(search = window.location.search): boolean {
  return new URLSearchParams(search).get("game") === "1";
}

export type StartMotionSessionOptions = {
  packScratch?: Omit<PackScratchLink, "settledOpeningIds"> & {
    settledOpeningIds?: string[];
  };
  completedMotionIds?: string[];
};

export function startMotionSession(
  hand: ThemedMotionCard[],
  options?: StartMotionSessionOptions,
): GameSession {
  const existing = loadGameSession();
  const readyId = options?.packScratch?.readyPackId;
  if (
    existing &&
    readyId &&
    existing.packScratch?.readyPackId === readyId &&
    existing.phase !== "motion"
  ) {
    return existing;
  }
  if (
    existing &&
    readyId &&
    existing.packScratch?.readyPackId === readyId &&
    existing.phase === "motion"
  ) {
    const completed = [
      ...new Set([
        ...existing.completedMotionIds,
        ...(options?.completedMotionIds ?? []),
      ]),
    ];
    const next: GameSession = {
      ...existing,
      completedMotionIds: completed,
      packScratch: options?.packScratch
        ? {
            ...existing.packScratch,
            ...options.packScratch,
            settledOpeningIds:
              options.packScratch.settledOpeningIds ??
              existing.packScratch.settledOpeningIds,
          }
        : existing.packScratch,
    };
    saveGameSession(next);
    persistPackScratchInventory(next);
    return next;
  }

  const first = hand[0];
  const session: GameSession = {
    version: 1,
    phase: "motion",
    motionCardIds: hand.map((card) => card.id),
    themes: hand.map((card) => card.theme),
    modelId: first?.model_id?.trim() || "",
    completedMotionIds: options?.completedMotionIds ?? [],
    photoPrizeTotal: 0,
    wonPhotoIds: [],
    completedPhotoIds: [],
    diamondTotal: 0,
    walletCredited: false,
    packScratch: options?.packScratch
      ? {
          ...options.packScratch,
          settledOpeningIds: options.packScratch.settledOpeningIds ?? [],
        }
      : undefined,
  };
  saveGameSession(session);
  return session;
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

/** Assign Photo Cards for this Motion Card win and open the result overlay. */
export async function awardMotionCardPhotos(
  cardId: string,
  prize: number,
): Promise<GameSession | null> {
  const session = loadGameSession();
  if (!session) return null;
  const total = Math.max(1, session.motionCardIds.length);
  const current = Math.max(1, session.completedMotionIds.indexOf(cardId) + 1);
  if (prize <= 0) {
    const next: GameSession = {
      ...session,
      lastMotionWinPhotoIds: [],
      pendingMotionResult: { cardId, photoIds: [], prize: 0, current, total },
    };
    saveGameSession(next);
    persistPackScratchInventory(next);
    return next;
  }
  const catalog = await loadGameCatalog();
  const theme = themeForMotionCard(session, cardId);
  const picked = pickWonPhotocards(
    catalog.photos,
    prize,
    theme ? [theme, ...session.themes] : session.themes,
    session.wonPhotoIds,
  );
  const photoIds = picked.map((photo) => photo.id);
  const next: GameSession = {
    ...session,
    wonPhotoIds: [...session.wonPhotoIds, ...photoIds],
    lastMotionWinPhotoIds: photoIds,
    pendingMotionResult: { cardId, photoIds, prize, current, total },
  };
  saveGameSession(next);
  persistPackScratchInventory(next);
  return next;
}

export function clearPendingMotionResult(): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  if (!session.pendingMotionResult && !session.lastMotionWinPhotoIds?.length) {
    return session;
  }
  const next: GameSession = {
    ...session,
    pendingMotionResult: undefined,
  };
  saveGameSession(next);
  return next;
}

/** After all motion cards: keep awarded photos and move to Photo Card Summary. */
export async function finishMotionHand(): Promise<GameSession | null> {
  const session = loadGameSession();
  if (!session) return null;
  if (session.phase !== "motion") return session;

  let wonPhotoIds = session.wonPhotoIds;
  if (wonPhotoIds.length === 0 && session.photoPrizeTotal > 0) {
    const catalog = await loadGameCatalog();
    wonPhotoIds = pickWonPhotocards(
      catalog.photos,
      session.photoPrizeTotal,
      session.themes,
    ).map((photo) => photo.id);
  }
  const next: GameSession = {
    ...session,
    phase: "photo_reveal",
    wonPhotoIds,
    pendingMotionResult: undefined,
  };
  saveGameSession(next);
  persistPackScratchInventory(next);
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
