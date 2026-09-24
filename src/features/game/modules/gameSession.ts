import { apiMutate } from "@/lib/api";
import { getAuthUserId } from "@/services/auth";
import { recordWonPhotoCards } from "@/services/collectionState";
import {
  removeReadyToScratch,
  upsertReadyToScratch,
} from "@/services/readyToScratch";
import type { OpeningSession } from "@/services/purchase";
import {
  loadGameCatalog,
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
  /** Server pack opening row — required for reveal API during motion play. */
  serverOpeningId?: string;
  /** PackOpeningCard ids (parallel to openingCardIds) for server reveal. */
  serverRevealCardIds?: string[];
};

export const GAME_SESSION_KEY = "sugar_scratchie_game_v1";
const SESSIONS_STORE_KEY = "sugar_scratchie_sessions_v1";

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
  /**
   * Won ids already counted into the collection ledger. The ledger is a plain
   * additive counter with no per-card dedupe, so the session has to remember
   * this or a hand gets counted again when it settles.
   */
  collectedPhotoIds?: string[];
  completedPhotoIds: string[];
  /** Accumulated diamonds from motion (and legacy photo) match games. */
  diamondTotal: number;
  /** Accumulated coins from motion card wins (display / settle bookkeeping). */
  coinTotal?: number;
  /** True after diamondTotal has been applied to the app wallet. */
  walletCredited: boolean;
  /** Set when motion play continues a pack opening from PurchaseFlow. */
  packScratch?: PackScratchLink;
  /** Photo Cards awarded by the Motion Card that just completed (legacy). */
  lastMotionWinPhotoIds?: string[];
  /** Result overlay waiting for auto-advance to the next motion card. */
  pendingMotionResult?: {
    cardId: string;
    /** Legacy field — motion wins no longer award photo cards. */
    photoIds: string[];
    coins: number;
    diamonds: number;
    prize: number;
    current: number;
    total: number;
  };
  /** Account that created this session — never PUT under a different user. */
  ownerUserId?: string;
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
    (v.walletCredited === undefined || typeof v.walletCredited === "boolean")
  );
}

function normalizeGameSession(session: GameSession): GameSession {
  return {
    ...session,
    walletCredited: session.walletCredited === true,
  };
}

type GameSessionStore = {
  version: 1;
  activeKey: string;
  byKey: Record<string, GameSession>;
};

function isGameSessionStore(value: unknown): value is GameSessionStore {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.activeKey === "string" &&
    !!v.byKey &&
    typeof v.byKey === "object"
  );
}

function emptyStore(): GameSessionStore {
  return { version: 1, activeKey: "hub", byKey: {} };
}

/** Storage bucket: pack readyPackId, or `hub` for GameHub-only sessions. */
export function gameSessionStorageKey(session: GameSession): string {
  return session.packScratch?.readyPackId ?? "hub";
}

function readStoreFromStorage(storage: Storage): GameSessionStore | null {
  try {
    const raw = storage.getItem(SESSIONS_STORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isGameSessionStore(parsed)) return null;
    const byKey: Record<string, GameSession> = {};
    for (const [key, value] of Object.entries(parsed.byKey)) {
      if (isGameSession(value)) byKey[key] = normalizeGameSession(value);
    }
    return { version: 1, activeKey: parsed.activeKey, byKey };
  } catch {
    return null;
  }
}

function migrateLegacySingleSession(store: GameSessionStore): GameSessionStore {
  if (Object.keys(store.byKey).length > 0 || typeof window === "undefined") {
    return store;
  }
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(GAME_SESSION_KEY);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!isGameSession(parsed)) continue;
      const session = normalizeGameSession(parsed);
      const key = gameSessionStorageKey(session);
      return { version: 1, activeKey: key, byKey: { [key]: session } };
    } catch {
      continue;
    }
  }
  return store;
}

function readStore(): GameSessionStore {
  if (typeof window === "undefined") return emptyStore();
  const store =
    readStoreFromStorage(window.sessionStorage) ??
    readStoreFromStorage(window.localStorage) ??
    emptyStore();
  return migrateLegacySingleSession(store);
}

function writeStore(store: GameSessionStore): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify(store);
    window.sessionStorage.setItem(SESSIONS_STORE_KEY, payload);
    window.localStorage.setItem(SESSIONS_STORE_KEY, payload);
    const active = store.byKey[store.activeKey];
    if (active) {
      const legacy = JSON.stringify(active);
      window.sessionStorage.setItem(GAME_SESSION_KEY, legacy);
      window.localStorage.setItem(GAME_SESSION_KEY, legacy);
    } else {
      window.sessionStorage.removeItem(GAME_SESSION_KEY);
      window.localStorage.removeItem(GAME_SESSION_KEY);
    }
  } catch {
    // Ignore quota / private mode.
  }
}

function setActiveStoreKey(key: string): GameSession | null {
  const store = readStore();
  const session = store.byKey[key];
  if (!session) return null;
  store.activeKey = key;
  writeStore(store);
  return session;
}

export function listStoredGameSessions(): GameSession[] {
  return Object.values(readStore().byKey);
}

export function loadGameSessionForPack(readyPackId: string): GameSession | null {
  return readStore().byKey[readyPackId] ?? null;
}

export function activateGameSessionForPack(readyPackId: string): GameSession | null {
  return setActiveStoreKey(readyPackId);
}

export function loadGameSession(): GameSession | null {
  const store = readStore();
  return store.byKey[store.activeKey] ?? null;
}

export function saveGameSession(session: GameSession): void {
  if (typeof window === "undefined") return;
  const userId = getAuthUserId();
  if (session.ownerUserId && userId && session.ownerUserId !== userId) {
    return;
  }
  const next: GameSession = userId
    ? { ...session, ownerUserId: userId }
    : session;
  const store = readStore();
  const key = gameSessionStorageKey(next);
  store.byKey[key] = next;
  store.activeKey = key;
  writeStore(store);
  // Guests and foreign leftover sessions must not write /api/me/game-session.
  if (!userId) return;
  void apiMutate("/api/me/game-session", {
    method: "PUT",
    body: JSON.stringify(next),
  }).catch(() => undefined);
}

/** Drop every stored game session (logout / account switch). */
export function clearAllGameSessions(): void {
  if (typeof window === "undefined") return;
  writeStore(emptyStore());
}

export function clearGameSession(key?: string): void {
  if (typeof window === "undefined") return;
  const store = readStore();
  const target = key ?? store.activeKey;
  delete store.byKey[target];
  const keys = Object.keys(store.byKey);
  if (store.activeKey === target) {
    store.activeKey = keys[0] ?? "hub";
  }
  writeStore(store);
}

/** Keep opened-pack Ready to Scratch in sync with the live game session. */
export function persistPackScratchInventory(session: GameSession): void {
  const link = session.packScratch;
  if (!link) return;
  // Past the motion phase the pack has no Motion Cards left to scratch, whatever
  // settledOpeningIds says — an opening card the hand never mapped (hand caps at
  // GAME_HAND_SIZE) or a settle that failed would otherwise strand the shelf row
  // forever as a ghost "Resume" tile.
  if (session.phase !== "motion") {
    removeReadyToScratch(link.readyPackId);
    return;
  }
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
  const readyId = options?.packScratch?.readyPackId;
  const existing = readyId
    ? loadGameSessionForPack(readyId)
    : readStore().byKey.hub ?? null;
  if (
    existing &&
    readyId &&
    existing.packScratch?.readyPackId === readyId &&
    existing.phase !== "motion"
  ) {
    setActiveStoreKey(readyId);
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

/** Record a finished motion card and its prize units (now currency, not photos). */
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

/** Coins shown/awarded for a motion win when no pack opening reward exists. */
export const MOTION_COINS_PER_PRIZE = 50;

function packRewardCoinsForMotionCard(
  session: GameSession,
  cardId: string,
): number {
  const { packScratch } = session;
  if (!packScratch) return 0;
  const index = session.motionCardIds.indexOf(cardId);
  if (index < 0) return 0;
  const openingId = packScratch.openingCardIds[index];
  if (!openingId) return 0;
  const card = packScratch.openingSession.cards.find(
    (entry) => entry.id === openingId,
  );
  return Math.max(0, card?.reward ?? 0);
}

export function coinsForMotionPrize(
  prize: number,
  packRewardCoins = 0,
  opts?: { packLinked?: boolean },
): number {
  if (prize <= 0) return 0;
  if (opts?.packLinked) return Math.max(0, packRewardCoins);
  return Math.max(0, prize) * MOTION_COINS_PER_PRIZE;
}

export function diamondsForMotionPrize(prize: number): number {
  return Math.max(0, Math.floor(prize));
}

/**
 * Bank coin + diamond rewards for this Motion Card win and open the result overlay.
 * Photo cards are no longer awarded from motion wins.
 */
export function awardMotionCardCurrency(
  cardId: string,
  prize: number,
): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  const total = Math.max(1, session.motionCardIds.length);
  const current = Math.max(1, session.completedMotionIds.indexOf(cardId) + 1);
  const packLinked = Boolean(session.packScratch);
  const packCoins = packRewardCoinsForMotionCard(session, cardId);
  const coins = coinsForMotionPrize(prize, packCoins, { packLinked });
  const diamonds = diamondsForMotionPrize(prize);
  const next: GameSession = {
    ...session,
    lastMotionWinPhotoIds: [],
    coinTotal: Math.max(0, session.coinTotal ?? 0) + coins,
    // Pack openings credit currency via the reveal API / reward event.
    // Hub hands bank diamonds here for the end-of-hand wallet settle.
    diamondTotal:
      session.diamondTotal + (packLinked ? 0 : diamonds),
    pendingMotionResult: {
      cardId,
      photoIds: [],
      coins,
      diamonds,
      prize: Math.max(0, prize),
      current,
      total,
    },
  };
  saveGameSession(next);
  persistPackScratchInventory(next);
  return next;
}

/** @deprecated Use awardMotionCardCurrency — motion wins no longer award photos. */
export async function awardMotionCardPhotos(
  cardId: string,
  prize: number,
  _catalog?: Awaited<ReturnType<typeof loadGameCatalog>>,
): Promise<GameSession | null> {
  return awardMotionCardCurrency(cardId, prize);
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

/**
 * After all motion cards: bank currency and finish the hand.
 * Legacy sessions that already won photo ids still enter photo_reveal.
 */
export async function finishMotionHand(): Promise<GameSession | null> {
  const session = loadGameSession();
  if (!session) return null;
  if (session.phase !== "motion") return session;

  const wonPhotoIds = session.wonPhotoIds;
  const next: GameSession = {
    ...session,
    phase: wonPhotoIds.length > 0 ? "photo_reveal" : "done",
    wonPhotoIds,
    pendingMotionResult: undefined,
  };
  // Only count collection when legacy photo ids are present.
  const recorded =
    wonPhotoIds.length > 0 ? recordAwardedPhotoCards(next) : next;
  saveGameSession(recorded);
  persistPackScratchInventory(recorded);
  return recorded;
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
  if (session.phase === "done") return session;
  const next: GameSession = { ...session, phase: "done" };
  saveGameSession(next);
  return next;
}

/** True when every won photo id is already in completedPhotoIds. */
export function isPhotoHandFullyComplete(session: GameSession): boolean {
  if (session.wonPhotoIds.length === 0) return false;
  const done = new Set(session.completedPhotoIds);
  return session.wonPhotoIds.every((id) => done.has(id));
}

/**
 * Promote an all-complete photo phase to done (idempotent).
 * Used when the last card was recorded but finish was delayed, or on reload.
 */
export function promoteCompletePhotoHand(): GameSession | null {
  const session = loadGameSession();
  if (!session) return null;
  if (session.phase === "done") return session;
  if (session.phase !== "photo" && session.phase !== "photo_reveal") {
    return session;
  }
  if (!isPhotoHandFullyComplete(session)) return session;
  return finishPhotoHand();
}

/** Won photo ids not yet counted into the collection ledger. */
export function pendingCollectionPhotoIds(session: GameSession): string[] {
  const already = new Set(session.collectedPhotoIds ?? []);
  return session.wonPhotoIds.filter((id) => !already.has(id));
}

/**
 * Count newly awarded photo cards into the collection ledger, once each.
 * Every award path funnels through here — the win overlay claims "Added to your
 * Collection" as each Motion Card resolves, but a catalog miss there would
 * otherwise leave those ids uncounted until the hand settles.
 */
function recordAwardedPhotoCards(session: GameSession): GameSession {
  const pending = pendingCollectionPhotoIds(session);
  if (pending.length === 0) return session;
  const creatorName = session.packScratch?.creator ?? session.themes[0] ?? "Game";
  recordWonPhotoCards({
    count: pending.length,
    creatorId: creatorName.trim().toLowerCase().replace(/\s+/g, "-") || "game",
    creatorName,
  });
  return {
    ...session,
    collectedPhotoIds: [...(session.collectedPhotoIds ?? []), ...pending],
  };
}

/**
 * Credit wallet (once), write collection, clear done session.
 * Safe to call from Collect, countdown, unmount, or shell exit.
 */
export function settleDonePhotoHand(
  addDiamonds: (amount: number) => void,
): boolean {
  const promoted = promoteCompletePhotoHand();
  const session = promoted ?? loadGameSession();
  if (!session || session.phase !== "done") return false;

  if (!session.walletCredited) {
    if (session.diamondTotal > 0) {
      addDiamonds(session.diamondTotal);
    }
    markWalletCredited();
  }

  const current = loadGameSession();
  if (current?.phase === "done") {
    // Normally a no-op — the award paths already counted these. Still the last
    // net for ids that missed the catalog on the way in. No save: the session
    // is cleared on the next line.
    recordAwardedPhotoCards(current);
    clearCompletedPhotoHand();
  }
  return true;
}

/** Drop a finished photo hand so Collection resume won't reopen the summary. */
export function clearCompletedPhotoHand(): boolean {
  const session = loadGameSession();
  if (!session || session.phase !== "done") return false;
  clearGameSession(gameSessionStorageKey(session));
  return true;
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
