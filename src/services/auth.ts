/**
 * v8 Authentication — identity + session + pending protected actions only.
 * Recommendation lives in ./recommendation.ts (independent system).
 */

import { apiFetch, apiMutate, ApiError } from "../lib/api";
import type { AppTab } from "@/types/app";
import type { PurchaseFlowPack } from "./purchase";

export type AuthUser = {
  id: string;
  email: string;
  provider: AuthProvider;
  emailVerified: boolean;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  genderInterest: "male" | "female" | "both" | null;
  referralCode: string;
  welcomeClaimed: boolean;
  homeTutorialDone: boolean;
  recommendationStatus: string | null;
};

const AUTH_KEY = "sugar.v8.authenticated";
const EMAIL_KEY = "sugar.v8.authEmail";
const USER_ID_KEY = "sugar.v8.authUserId";
const EMAIL_VERIFIED_KEY = "sugar.v8.emailVerified";
const PROVIDER_KEY = "sugar.v8.authProvider";
const HAS_LOGGED_IN_COOKIE = "sugar.v8.hasLoggedIn";
const HAS_LOGGED_IN_MAX_AGE = 60 * 60 * 24 * 365;

export type ProtectedActionType =
  | "like-creator"
  | "buy-pack"
  | "open-pack"
  | "scratch-card"
  | "view-collection"
  | "view-rewards"
  | "view-profile"
  | "open-store"
  | "redeem-code"
  | "claim-reward"
  | "session-expired";

export type ProtectedAction =
  | { type: "buy"; pack: PurchaseFlowPack; kind?: "buy-pack" | "open-pack" }
  | { type: "like"; feedItemId: string }
  | { type: "tab"; tab: AppTab }
  | { type: "scratch"; pack: PurchaseFlowPack }
  | { type: "photo-scratch"; packId?: string }
  | { type: "store" }
  | { type: "inbox" };

export type AuthenticationSheetMode =
  | "login"
  | "create-account"
  | "forgot-password"
  | "reset-sent";

export type AuthProvider = "google" | "apple" | "email";

export type AuthSuccessResult = {
  email: string;
  provider: AuthProvider;
  /** Server user from login/register/oauth when available. */
  user?: AuthUser;
};

export function isAuthenticated() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function getAuthEmail() {
  try {
    return sessionStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return "";
}

export function hasLoggedInBefore() {
  try {
    if (readCookie(HAS_LOGGED_IN_COOKIE) === "1") return true;
    return localStorage.getItem(HAS_LOGGED_IN_COOKIE) === "1";
  } catch {
    return false;
  }
}

export function markHasLoggedIn() {
  try {
    document.cookie = `${HAS_LOGGED_IN_COOKIE}=1; path=/; max-age=${HAS_LOGGED_IN_MAX_AGE}; SameSite=Lax`;
    localStorage.setItem(HAS_LOGGED_IN_COOKIE, "1");
  } catch {
    /* ignore */
  }
}

export function clearHasLoggedIn() {
  try {
    document.cookie = `${HAS_LOGGED_IN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    localStorage.removeItem(HAS_LOGGED_IN_COOKIE);
  } catch {
    /* ignore */
  }
}

/** Returns null when the request fails soft (network/timeout/non-OK). */
export async function fetchAuthSession(): Promise<{
  authenticated: boolean;
  user: AuthUser | null;
} | null> {
  return apiFetch<{ authenticated: boolean; user: AuthUser | null }>(
    "/api/auth/session",
  );
}

export async function loginWithEmail(email: string, password: string) {
  return apiMutate<{ ok: boolean; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerWithEmail(email: string, password: string) {
  return apiMutate<{ ok: boolean; user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginWithOAuth(
  provider: "google" | "apple",
  email: string,
) {
  return apiMutate<{ ok: boolean; user: AuthUser }>(
    `/api/auth/oauth/${provider}`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export async function logoutRemote() {
  try {
    await apiMutate("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
}

export async function requestPasswordReset(email: string) {
  await apiMutate("/api/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function markEmailVerifiedRemote() {
  try {
    await apiMutate("/api/auth/verify-email/mark", { method: "POST" });
  } catch {
    /* ignore */
  }
}

export function createSession(
  email: string,
  provider: AuthProvider = "email",
  userId?: string,
) {
  const normalized = email.trim().toLowerCase();
  try {
    sessionStorage.setItem(AUTH_KEY, "1");
    sessionStorage.setItem(EMAIL_KEY, normalized);
    sessionStorage.setItem(PROVIDER_KEY, provider);
    localStorage.setItem(PROVIDER_KEY, provider);
    if (userId) sessionStorage.setItem(USER_ID_KEY, userId);
    else sessionStorage.removeItem(USER_ID_KEY);
  } catch {
    /* ignore */
  }
  markHasLoggedIn();
  if (provider === "google" || provider === "apple") {
    markEmailVerified();
  }
}

export function getAuthUserId(): string | null {
  try {
    const id = sessionStorage.getItem(USER_ID_KEY);
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export function destroySession() {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(USER_ID_KEY);
    sessionStorage.removeItem(PROVIDER_KEY);
  } catch {
    /* ignore */
  }
}

export function getAuthProvider(): AuthProvider {
  try {
    const raw =
      sessionStorage.getItem(PROVIDER_KEY) ??
      localStorage.getItem(PROVIDER_KEY);
    if (raw === "google" || raw === "apple" || raw === "email") return raw;
  } catch {
    /* ignore */
  }
  return "email";
}

export function needsEmailVerification() {
  return getAuthProvider() === "email" && !isEmailVerified();
}

export function isEmailVerified() {
  try {
    return localStorage.getItem(EMAIL_VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markEmailVerified() {
  try {
    localStorage.setItem(EMAIL_VERIFIED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearEmailVerified() {
  try {
    localStorage.removeItem(EMAIL_VERIFIED_KEY);
  } catch {
    /* ignore */
  }
}

/** Prototype rule: at least this many characters. */
export const AUTH_PASSWORD_MIN_LENGTH = 8;

export function isValidAuthPassword(pw: string) {
  return pw.length >= AUTH_PASSWORD_MIN_LENGTH;
}

export function authFailureMessage() {
  return "Incorrect email or password.";
}

export function createAccountFailureMessage() {
  return "Unable to create account. Please try again.";
}

export function duplicateEmailMessage() {
  return createAccountFailureMessage();
}

export function forgotPasswordSuccessMessage() {
  return "If an account exists for this email, password-reset instructions have been sent.";
}

export type ChangePasswordError =
  | "incorrect_current"
  | "invalid_new"
  | "generic";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: ChangePasswordError };

/**
 * Authenticated password update — prototype.
 * Demo incorrect current: enter `wrong` as the current password.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  if (!currentPassword.trim()) {
    return { ok: false, error: "incorrect_current" };
  }
  if (!isValidAuthPassword(newPassword)) {
    return { ok: false, error: "invalid_new" };
  }
  try {
    await apiMutate("/api/auth/password/change", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.message === "incorrect_current") {
      return { ok: false, error: "incorrect_current" };
    }
    return { ok: false, error: "generic" };
  }
}

export function changePasswordErrorMessage(error: ChangePasswordError) {
  if (error === "incorrect_current") {
    return "Current password is incorrect.";
  }
  if (error === "invalid_new") {
    return `Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`;
  }
  return "We couldn't change your password. Please try again.";
}

export function triggerFromAction(
  action: ProtectedAction | null,
): ProtectedActionType | undefined {
  if (!action) return undefined;
  if (action.type === "like") return "like-creator";
  if (action.type === "scratch" || action.type === "photo-scratch") {
    return "scratch-card";
  }
  if (action.type === "store") return "open-store";
  if (action.type === "inbox") return "view-rewards";
  if (action.type === "buy") {
    return action.kind === "open-pack" || action.pack.entry === "open"
      ? "open-pack"
      : "buy-pack";
  }
  if (action.type === "tab") {
    if (action.tab === "bag") return "view-collection";
    if (action.tab === "hub") return "view-rewards";
    if (action.tab === "profile") return "view-profile";
  }
  return undefined;
}

export function supportingCopyForTrigger(
  trigger?: ProtectedActionType,
): string {
  switch (trigger) {
    case "like-creator":
      return "Log in to save creators you like.";
    case "buy-pack":
      return "Log in to purchase this pack and save it to your account.";
    case "open-pack":
      return "Log in to open this pack and save it to your account.";
    case "view-collection":
      return "Log in to view and continue your collection.";
    case "view-rewards":
    case "claim-reward":
    case "redeem-code":
      return "Log in to view and claim your rewards.";
    case "open-store":
      return "Log in to buy Diamonds.";
    case "scratch-card":
      return "Log in to save the cards you reveal.";
    case "view-profile":
      return "Log in or create an account to save your collection and continue where you left off.";
    case "session-expired":
      return "Your session expired. Log in to continue.";
    default:
      return "Log in or create an account to save your collection and continue where you left off.";
  }
}
