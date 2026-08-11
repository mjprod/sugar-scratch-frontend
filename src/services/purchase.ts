export type PackQuantity = 1 | 5;

/** Pack handed to the purchase / opening flow. */
export type PurchaseFlowPack = {
  packId: string;
  packName: string;
  price: string;
  creator: string;
  /** "open" enters the opening flow for packs the user already owns. */
  entry?: "purchase" | "open";
  /** Remaining unopened packs — drives the "No Remaining Packs" state. */
  unopenedPacks?: number;
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
  diamondCost: number;
  label: string;
  detail: string;
}[] = [
  { quantity: 1, diamondCost: 1, label: "Play 1 Pack", detail: "3 scratch cards" },
  { quantity: 5, diamondCost: 3, label: "Play 5 Packs", detail: "Bundle preview" },
];

export function packCost(quantity: PackQuantity) {
  return PACK_OPTIONS.find((option) => option.quantity === quantity)?.diamondCost ?? 0;
}

export function buildFoilOpeningSession(
  foils: { id: string; label: string; videoUrl: string }[],
): OpeningSession {
  const rarities: OpeningCard["rarity"][] = ["Super Rare", "Ultra Rare"];
  return {
    quantity: 1,
    diamondCost: packCost(1),
    cards: foils.slice(0, 2).map((foil, index) => ({
      id: foil.id,
      rarity: rarities[index] ?? "Rare",
      reward: index === 0 ? 25 : 50,
      faceUrl: foil.videoUrl,
    })),
  };
}

export function buildOpeningSession(quantity: PackQuantity): OpeningSession {
  const diamondCost = packCost(quantity);
  // ponytail: the prototype caps the five-pack preview at five cards; replace with
  // the backend opening-session payload when pack composition is implemented.
  const cardCount = quantity === 1 ? 3 : 5;
  const rarities: OpeningCard["rarity"][] = ["Rare", "Rare", "Super Rare", "Rare", "Ultra Rare"];

  return {
    quantity,
    diamondCost,
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: `card-${quantity}-${index + 1}`,
      rarity: rarities[index],
      reward: index === cardCount - 1 ? 50 : 10 + index * 5,
    })),
  };
}

/* ---------------------------------------------------------------------------
 * Purchase requests (mocked network)
 * ------------------------------------------------------------------------ */

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

export async function submitPurchase(
  quantity: PackQuantity,
  balance: number,
): Promise<OpeningSession> {
  if (packCost(quantity) > balance) throw new PurchaseError("insufficient");
  await wait(650);
  if (failureMode() === "purchase") {
    throw new PurchaseError("failed", "Purchase could not be completed.");
  }
  return buildOpeningSession(quantity);
}

export async function loadOpeningAssets(): Promise<void> {
  await wait(450);
  if (failureMode() === "assets") {
    throw new PurchaseError("assets", "Pack assets failed to download.");
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

/** First card that still needs scratching, or null when the session is done. */
export function nextUnscratchedIndex(
  session: OpeningSession,
  scratched: string[],
): number | null {
  const index = session.cards.findIndex((card) => !scratched.includes(card.id));
  return index === -1 ? null : index;
}
