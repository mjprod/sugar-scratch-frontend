/**
 * Redeem Code — promo codes → Diamonds or free Pack.
 */

import { apiMutate } from "../lib/api";
import { isDemoMode } from "../lib/demo";

export type RedeemReward =
  | { type: "diamonds"; amount: number }
  | {
      type: "free_pack";
      packId: string;
      creatorHandle: string;
      sceneName: string;
      /** Server-issued row from POST /api/rewards/redeem (production). */
      instanceId?: string;
    };

export type RedeemErrorType =
  | "invalid_code"
  | "already_redeemed"
  | "expired"
  | "unavailable"
  | "network_error";

export type RedeemCodeResponse = {
  success: boolean;
  reward?: RedeemReward;
  errorType?: RedeemErrorType;
};

const HISTORY_KEY = "sugar.v8.redeemHistory";

/** Hub inline error copy (spec §12–13). */
export const REDEEM_ERROR_COPY: Record<RedeemErrorType, string> = {
  invalid_code: "This code isn't valid. Check the code and try again.",
  already_redeemed: "You've already redeemed this code.",
  expired: "This code has expired.",
  unavailable: "This code is no longer available.",
  network_error: "Something went wrong — please try again.",
};

const DEMO_CODES: Record<
  string,
  | { kind: "ok"; reward: RedeemReward }
  | { kind: "error"; errorType: RedeemErrorType }
> = {
  SUGAR2026: { kind: "ok", reward: { type: "diamonds", amount: 100 } },
  BONUS50: { kind: "ok", reward: { type: "diamonds", amount: 50 } },
  "MINA-DROP": {
    kind: "ok",
    reward: {
      type: "free_pack",
      packId: "ep1",
      creatorHandle: "Mina",
      sceneName: "Neon Rain",
    },
  },
  WELCOME100: { kind: "error", errorType: "already_redeemed" },
  GONE2025: { kind: "error", errorType: "expired" },
  LIMITED50: { kind: "error", errorType: "unavailable" },
};

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

function readHistoryCodes(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string");
  } catch {
    return [];
  }
}

function writeHistoryCodes(codes: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(codes));
  } catch {
    /* ignore */
  }
}

function markRedeemed(code: string) {
  const next = [code, ...readHistoryCodes().filter((c) => c !== code)];
  writeHistoryCodes(next);
}

/** `?demo=1` only — offline fixture catalog when the API is unreachable. */
function redeemFromDemoCatalog(code: string): RedeemCodeResponse {
  if (readHistoryCodes().includes(code)) {
    return { success: false, errorType: "already_redeemed" };
  }

  const entry = DEMO_CODES[code];
  if (!entry) return { success: false, errorType: "invalid_code" };
  if (entry.kind === "error") {
    return { success: false, errorType: entry.errorType };
  }

  markRedeemed(code);
  return { success: true, reward: entry.reward };
}

/** Redeem a promo code. Case-insensitive; trims whitespace. */
export async function redeemCode(raw: string): Promise<RedeemCodeResponse> {
  const code = normalizeCode(raw);
  if (!code) return { success: false, errorType: "invalid_code" };

  try {
    if (new URLSearchParams(window.location.search).get("redeem") === "network") {
      return { success: false, errorType: "network_error" };
    }
  } catch {
    /* ignore */
  }

  try {
    const remote = await apiMutate<RedeemCodeResponse>("/api/rewards/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    if (remote.success) markRedeemed(code);
    return remote;
  } catch {
    if (!isDemoMode()) {
      return { success: false, errorType: "network_error" };
    }
  }

  return redeemFromDemoCatalog(code);
}
