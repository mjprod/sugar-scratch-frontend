import { apiMutate } from "../lib/api";
import { isDemoMode } from "../lib/demo";
import { diamondCostForPackId } from "./homepage";

export type PackQuantity = 1 | 5;

/** Pack handed to the purchase / opening flow. */
export type PurchaseFlowPack = {
  packId: string;
  packName: string;
  price: string;
  creator: string;
  /** Collection theme label when distinct from packName (e.g. Cyber Nights). */
  themeName?: string;
  /**
   * purchase — buy then open
   * open — open an owned sealed pack
   * scratch — resume Ready-to-Scratch (never replays pack opening)
   * cart-tear — open remaining cart packs on the Tear stage
   */
  entry?: "purchase" | "open" | "scratch" | "cart-tear";
  /** Remaining unopened packs — drives the "No Remaining Packs" state. */
  unopenedPacks?: number;
  /** Cart leftovers to open on Tear (video faces included). */
  cartFoils?: Array<{
    id: string;
    label: string;
    videoUrl: string;
    slot?: 1 | 2;
  }>;
  /** Specific owned pack instance when resuming Open Pack. */
  instanceId?: string;
  /** Purchase transaction id — used for multi-pack continuation. */
  purchaseId?: string;
  /** Cart tear queue — open order when checkout spans multiple purchases. */
  tearInstanceIds?: string[];
};

export type OpeningCard = {
  id: string;
  rarity: "Rare" | "Super Rare" | "Ultra Rare";
  reward: number;
  /** Optional designed face (foil video / image from the model API). */
  faceUrl?: string;
};

export type OpeningSession = {
  quantity: PackQuantity;
  diamondCost: number;
  cards: OpeningCard[];
  /** Foil face used on Pack Ready after the user picks a pack. */
  foilFaceUrl?: string;
  foilLabel?: string;
};

export const PACK_OPTIONS: {
  quantity: PackQuantity;
  label: string;
  detail: string;
}[] = [
  { quantity: 1, label: "Play 1 Pack", detail: "3 scratch cards" },
  { quantity: 5, label: "Play 5 Packs", detail: "Bundle preview" },
];

/** Same unit Diamond cost shown on ranking / pack surfaces. */
export function packUnitCost(packId = "pack") {
  return diamondCostForPackId(packId);
}

export function packCost(quantity: PackQuantity, packId = "pack") {
  const unit = packUnitCost(packId);
  // ponytail: 5-pack keeps the old 3× demo bundle ratio until real pricing exists.
  return quantity === 1 ? unit : unit * 3;
}

export function buildOpeningSession(
  quantity: PackQuantity,
  packId = "pack",
): OpeningSession {
  const diamondCost = packCost(quantity, packId);
  // ponytail: the prototype caps the five-pack preview at five cards; replace with
  // the backend opening-session payload when pack composition is implemented.
  const cardCount = quantity === 1 ? 3 : 5;
  const rarities: OpeningCard["rarity"][] = ["Rare", "Rare", "Super Rare", "Rare", "Ultra Rare"];

  return {
    quantity,
    diamondCost,
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: `card-${packId}-${quantity}-${index + 1}`,
      rarity: rarities[index],
      reward: index === cardCount - 1 ? 50 : 10 + index * 5,
    })),
  };
}

export function buildFoilOpeningSession(
  foils: { id: string; label: string; videoUrl: string }[],
  diamondCost = packCost(1),
): OpeningSession {
  const rarities: OpeningCard["rarity"][] = ["Super Rare", "Ultra Rare"];
  return {
    quantity: 1,
    diamondCost,
    cards: foils.slice(0, 2).map((foil, index) => ({
      id: foil.id,
      rarity: rarities[index] ?? "Rare",
      reward: index === 0 ? 25 : 50,
      faceUrl: foil.videoUrl,
    })),
  };
}

/* ---------------------------------------------------------------------------
 * Purchase requests
 * ------------------------------------------------------------------------ */

export type PackInstanceApi = {
  instanceId: string;
  catalogPackId: string;
  packName: string;
  creator: string;
  creatorId?: string;
  themeName: string;
  coverUrl: string;
  status: "unopened" | "opened";
  purchaseId: string;
  savedAt: number;
};

export type PurchaseResult = {
  purchaseId: string;
  instances: PackInstanceApi[];
  wallet: { diamonds: number; coins: number };
  diamondCost: number;
};

export type PurchaseErrorKind = "insufficient" | "failed" | "assets";

export class PurchaseError extends Error {
  kind: PurchaseErrorKind;
  constructor(kind: PurchaseErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = "PurchaseError";
  }
}

/**
 * ponytail: failures are demo-triggered via `?fail=purchase|assets|session`
 * instead of a random rate, so the error states stay reproducible.
 * Replace with real request outcomes when the API exists.
 */
export function failureMode(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("fail");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newIdempotencyToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function purchaseIdempotencyStorageKey(packId: string, quantity: PackQuantity) {
  return `sugar.v8.packBuyIdempotency:${packId}:${quantity}`;
}

/** Stable across retries of the same in-flight buy; cleared after the client commits. */
function getPurchaseIdempotencyKey(
  packId: string,
  quantity: PackQuantity,
  explicit?: string,
): string {
  if (explicit) return explicit;
  const storageKey = purchaseIdempotencyStorageKey(packId, quantity);
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const key = `pack-buy:${packId}:${quantity}:${newIdempotencyToken()}`;
    sessionStorage.setItem(storageKey, key);
    return key;
  } catch {
    return `pack-buy:${packId}:${quantity}:${newIdempotencyToken()}`;
  }
}

function clearPurchaseIdempotencyKey(packId: string, quantity: PackQuantity) {
  try {
    sessionStorage.removeItem(purchaseIdempotencyStorageKey(packId, quantity));
  } catch {
    /* ignore */
  }
}

/** Drop the in-flight key after the client has fully committed the purchase. */
export function commitPurchaseIdempotencyKey(
  packId: string,
  quantity: PackQuantity,
) {
  clearPurchaseIdempotencyKey(packId, quantity);
}

/** One distinct server purchase per Pack Pocket line at checkout. */
export function cartCheckoutIdempotencyKey(cartItemId: string): string {
  const id = cartItemId.trim();
  return id ? `cart-buy:${id}` : `cart-buy:${newIdempotencyToken()}`;
}

function newDemoInstanceId() {
  return `demo-pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newDemoPurchaseId() {
  return `demo-tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** `?demo=1` only — offline fixture when the API is unreachable. */
function purchaseFromDemoFixture(
  quantity: PackQuantity,
  balance: number,
  packId: string,
  coinBalance: number,
): PurchaseResult {
  const diamondCost = packCost(quantity, packId);
  if (diamondCost > balance) throw new PurchaseError("insufficient");
  const purchaseId = newDemoPurchaseId();
  const instances: PackInstanceApi[] = Array.from({ length: quantity }, () => ({
    instanceId: newDemoInstanceId(),
    catalogPackId: packId,
    packName: packId,
    creator: "Sugar",
    themeName: packId,
    coverUrl: "",
    status: "unopened",
    purchaseId,
    savedAt: Date.now(),
  }));
  return {
    purchaseId,
    instances,
    wallet: {
      diamonds: Math.max(0, balance - diamondCost),
      coins: coinBalance,
    },
    diamondCost,
  };
}

export async function submitPurchase(
  quantity: PackQuantity,
  balance: number,
  packId = "pack",
  idempotencyKey?: string,
  coinBalance = 0,
): Promise<PurchaseResult> {
  const diamondCost = packCost(quantity, packId);
  if (diamondCost > balance) throw new PurchaseError("insufficient");
  if (failureMode() === "purchase") {
    throw new PurchaseError("failed", "Purchase could not be completed.");
  }
  const key = getPurchaseIdempotencyKey(packId, quantity, idempotencyKey);
  try {
    const remote = await apiMutate<{
      purchaseId: string;
      instances: PackInstanceApi[];
      wallet: { diamonds: number; coins: number };
    }>(`/api/packs/${packId}/purchase`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ quantity }),
    });
    /* keep key until the client fully commits — retries after a lost response
       or a post-charge failure must reuse it */
    return {
      purchaseId: remote.purchaseId,
      instances: remote.instances,
      wallet: remote.wallet,
      diamondCost,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "insufficient") {
      clearPurchaseIdempotencyKey(packId, quantity);
      throw new PurchaseError("insufficient");
    }
    if (!isDemoMode()) {
      throw new PurchaseError("failed", "Purchase could not be completed.");
    }
    return purchaseFromDemoFixture(quantity, balance, packId, coinBalance);
  }
}

export async function loadOpeningAssets(): Promise<void> {
  await wait(450);
  if (failureMode() === "assets") {
    throw new PurchaseError("assets", "Pack assets failed to download.");
  }
}

export type OpenPackResult = {
  openingId: string;
  stage: string;
  cardIndex: number;
  session: OpeningSession;
  scratched: string[];
  instance: PackInstanceApi;
};

function mapOpeningSession(raw: {
  quantity: number;
  diamondCost: number;
  cards: Array<{
    id: string;
    rarity: string;
    reward: number;
    faceUrl?: string | null;
  }>;
  foilFaceUrl?: string | null;
  foilLabel?: string | null;
}): OpeningSession {
  return {
    quantity: (raw.quantity === 5 ? 5 : 1) as PackQuantity,
    diamondCost: raw.diamondCost,
    cards: raw.cards.map((card) => ({
      id: card.id,
      rarity: card.rarity as OpeningCard["rarity"],
      reward: card.reward,
      faceUrl: card.faceUrl ?? undefined,
    })),
    foilFaceUrl: raw.foilFaceUrl ?? undefined,
    foilLabel: raw.foilLabel ?? undefined,
  };
}

export type RevealCardResult = {
  card: { id: string; revealStatus: string; reward: number };
  scratched: string[];
  wallet: { diamonds: number; coins: number };
};

/** Reveal one scratched card — credits diamonds and collection on the server. */
export async function revealPackCard(
  openingId: string,
  cardId: string,
): Promise<RevealCardResult> {
  try {
    const remote = await apiMutate<{
      card: { id: string; revealStatus: string; reward: number };
      scratched: string[];
      wallet: { diamonds: number; coins: number };
    }>(`/api/me/openings/${openingId}/cards/${cardId}/reveal`, {
      method: "POST",
    });
    return {
      card: remote.card,
      scratched: remote.scratched,
      wallet: remote.wallet,
    };
  } catch {
    throw new PurchaseError("failed", "Card reveal could not be completed.");
  }
}

/** Open a sealed pack instance — deals cards on the server when authed. */
export async function openPackInstance(instanceId: string): Promise<OpenPackResult> {
  try {
    const remote = await apiMutate<{
      instance: PackInstanceApi;
      openingId: string;
      stage: string;
      cardIndex: number;
      session: {
        quantity: number;
        diamondCost: number;
        cards: Array<{
          id: string;
          rarity: string;
          reward: number;
          faceUrl?: string | null;
        }>;
        foilFaceUrl?: string | null;
        foilLabel?: string | null;
      };
      scratched: string[];
    }>(`/api/me/packs/${instanceId}/open`, { method: "POST" });
    return {
      openingId: remote.openingId,
      stage: remote.stage,
      cardIndex: remote.cardIndex,
      session: mapOpeningSession(remote.session),
      scratched: remote.scratched,
      instance: remote.instance,
    };
  } catch {
    throw new PurchaseError("failed", "Pack could not be opened.");
  }
}

/* ---------------------------------------------------------------------------
 * Opening session persistence (resume after interruption)
 * ------------------------------------------------------------------------ */

const OPENING_KEY = "sugar.v8.openingSession";
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

export type OpeningStage =
  | "ready"
  | "reveal"
  | "cards-ready"
  | "preview"
  | "grid"
  | "scratch"
  | "complete";

export type PersistedOpening = {
  packId: string;
  savedAt: number;
  session: OpeningSession;
  stage: OpeningStage;
  cardIndex: number;
  /** Card ids already fully scratched — never replayed on resume. */
  scratched: string[];
  /** Server opening row — required for reveal API on resume. */
  openingId?: string;
};

export type RestoreResult =
  | { status: "none" }
  | { status: "expired" }
  | { status: "resume"; data: PersistedOpening };

function isValidOpening(value: unknown): value is PersistedOpening {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PersistedOpening>;
  return (
    typeof data.packId === "string" &&
    typeof data.savedAt === "number" &&
    typeof data.stage === "string" &&
    typeof data.cardIndex === "number" &&
    Array.isArray(data.scratched) &&
    !!data.session &&
    Array.isArray(data.session.cards) &&
    data.session.cards.length > 0
  );
}

export function saveOpening(data: Omit<PersistedOpening, "savedAt">) {
  try {
    localStorage.setItem(
      OPENING_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() }),
    );
  } catch {
    /* storage unavailable — resume simply won't be offered */
  }
}

export function clearOpening() {
  try {
    localStorage.removeItem(OPENING_KEY);
  } catch {
    /* ignore */
  }
}

export function restoreOpening(packId: string): RestoreResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OPENING_KEY);
  } catch {
    return { status: "none" };
  }
  if (!raw) return { status: "none" };

  if (failureMode() === "session") {
    clearOpening();
    return { status: "expired" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearOpening();
    return { status: "expired" };
  }

  if (!isValidOpening(parsed)) {
    clearOpening();
    return { status: "expired" };
  }
  if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
    clearOpening();
    return { status: "expired" };
  }
  // A saved session for another pack is not this pack's business.
  if (parsed.packId !== packId) return { status: "none" };

  return { status: "resume", data: parsed };
}

/** Card ids in `revealedIds` not yet settled (local or server). */
export function freshRevealIds(revealedIds: string[], awarded: ReadonlySet<string>) {
  return revealedIds.filter((id) => !awarded.has(id));
}

/** First card that still needs scratching, or null when the session is done. */
export function nextUnscratchedIndex(
  session: OpeningSession,
  scratched: string[],
): number | null {
  const index = session.cards.findIndex((card) => !scratched.includes(card.id));
  return index === -1 ? null : index;
}
