/**
 * Daily Reward — one claim per local calendar day; resets at next local midnight.
 */

import { apiFetch, apiMutate } from "../lib/api";

const KEY = "sugar.v8.dailyRewardClaimDay";

/** Diamonds granted on claim (prototype). */
export const DAILY_REWARD_DIAMONDS = 10;

function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getClaimedDay(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function isDailyRewardClaimedToday(now = new Date()) {
  return getClaimedDay() === localDayKey(now);
}

/** Next local midnight after `now` — when today's claim window ends / next opens. */
export function getDailyRewardResetAt(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

export function claimDailyReward(now = new Date()): {
  ok: true;
  diamonds: number;
} | { ok: false; reason: "already_claimed" } {
  if (isDailyRewardClaimedToday(now)) {
    return { ok: false, reason: "already_claimed" };
  }
  try {
    localStorage.setItem(KEY, localDayKey(now));
  } catch {
    /* ignore */
  }
  void apiMutate("/api/rewards/daily/claim", { method: "POST" }).catch(() => undefined);
  return { ok: true, diamonds: DAILY_REWARD_DIAMONDS };
}

export async function fetchDailyRewardStatus() {
  return apiFetch<{
    claimedToday: boolean;
    diamonds: number;
    resetAt: number;
    claimDate: string;
  }>("/api/rewards/daily");
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
