/**
 * Theme Collection Completion Rewards — claim ledger + eligibility.
 * Progress comes from ownership (caller). Claimed state persists locally until
 * a backend reward service replaces this ledger.
 */
export type ThemeRewardStatus = "locked" | "claimable" | "claimed";

export type ThemeCompletionRewardView = {
  id: string;
  themeId: string;
  creatorId: string;
  status: ThemeRewardStatus;
  title: string;
  description: string;
  /** True once the reward catalog can hand out non-diamond prizes. */
  isMystery: boolean;
  /** Diamonds granted on the first successful claim. */
  diamondAmount: number;
  claimedAt?: number;
};

type ClaimLedger = {
  claimed: Record<string, number>;
};

const KEY = "sugar.v8.themeCompletionRewards";

/** Flat grant until a per-theme reward catalog exists. */
const DEFAULT_DIAMONDS = 50;

/** In-memory fallback when localStorage is missing (tests / private mode). */
let memoryLedger: ClaimLedger | null = null;

/** Test helper — clears persisted + memory claim ledger. */
export function resetThemeCompletionRewardsForTests() {
  memoryLedger = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function emptyLedger(): ClaimLedger {
  return { claimed: {} };
}

function parseLedger(raw: string): ClaimLedger {
  const parsed = JSON.parse(raw) as Partial<ClaimLedger>;
  const source =
    parsed.claimed && typeof parsed.claimed === "object" ? parsed.claimed : {};
  const claimed: Record<string, number> = {};
  for (const [id, at] of Object.entries(source)) {
    if (typeof at === "number" && Number.isFinite(at)) claimed[id] = at;
  }
  return { claimed };
}

/**
 * Cached after the first read — callers re-check status for every theme on
 * every render, and re-parsing localStorage each time is needlessly expensive.
 */
function readLedger(): ClaimLedger {
  if (memoryLedger) return memoryLedger;
  let ledger: ClaimLedger;
  try {
    const raw = localStorage.getItem(KEY);
    ledger = raw ? parseLedger(raw) : emptyLedger();
  } catch {
    ledger = emptyLedger();
  }
  memoryLedger = ledger;
  return ledger;
}

function writeLedger(ledger: ClaimLedger) {
  memoryLedger = ledger;
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    /* keep memory ledger */
  }
}

export function themeCompletionRewardId(
  creatorId: string,
  themeId: string,
): string {
  return `theme-complete:${creatorId.trim()}:${themeId.trim()}`;
}

export function isThemeCompletionClaimed(
  creatorId: string,
  themeId: string,
): boolean {
  const id = themeCompletionRewardId(creatorId, themeId);
  return Boolean(readLedger().claimed[id]);
}

export function resolveThemeRewardStatus(
  collected: number,
  total: number,
  claimed: boolean,
): ThemeRewardStatus {
  if (claimed) return "claimed";
  if (total > 0 && collected >= total) return "claimable";
  return "locked";
}

export function getThemeCompletionReward(input: {
  creatorId: string;
  themeId: string;
  themeName: string;
  collected: number;
  total: number;
}): ThemeCompletionRewardView {
  const id = themeCompletionRewardId(input.creatorId, input.themeId);
  const claimedAt = readLedger().claimed[id];
  const claimed = typeof claimedAt === "number";
  const status = resolveThemeRewardStatus(
    input.collected,
    input.total,
    claimed,
  );
  const theme = input.themeName.trim() || "Theme";
  return {
    id,
    themeId: input.themeId,
    creatorId: input.creatorId,
    status,
    title: `${theme} Completion Reward`,
    description:
      status === "claimed"
        ? "Reward Claimed"
        : status === "claimable"
          ? "Claim your exclusive Theme Reward"
          : "Complete the collection to unlock the reward.",
    // Every reward is a flat diamond grant until a reward catalog exists.
    isMystery: false,
    diamondAmount: DEFAULT_DIAMONDS,
    claimedAt: claimed ? claimedAt : undefined,
  };
}

export type ClaimThemeRewardResult =
  | { ok: true; alreadyClaimed: boolean; diamondAmount: number }
  | { ok: false; message: string };

/**
 * Idempotent claim. Persists claimed state before returning success so a
 * retry after a partial grant cannot double-issue.
 */
export function claimThemeCompletionReward(input: {
  creatorId: string;
  themeId: string;
  themeName: string;
  collected: number;
  total: number;
}): ClaimThemeRewardResult {
  const reward = getThemeCompletionReward(input);
  if (reward.status === "claimed") {
    return {
      ok: true,
      alreadyClaimed: true,
      diamondAmount: 0,
    };
  }
  if (reward.status !== "claimable") {
    return {
      ok: false,
      message: "Complete the collection before claiming this reward.",
    };
  }

  const ledger = readLedger();
  if (ledger.claimed[reward.id]) {
    return { ok: true, alreadyClaimed: true, diamondAmount: 0 };
  }
  ledger.claimed[reward.id] = Date.now();
  writeLedger(ledger);

  return {
    ok: true,
    alreadyClaimed: false,
    diamondAmount: reward.diamondAmount,
  };
}
