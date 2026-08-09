/**
 * v8 Authentication — identity + session + pending protected actions only.
 * Recommendation lives in ./recommendation.ts (independent system).
 */

import type { AppTab } from "@/types/app";
import type { PurchaseFlowPack } from "./purchase";

const AUTH_KEY = "sugar.v8.authenticated";
const EMAIL_KEY = "sugar.v8.authEmail";
const EMAIL_VERIFIED_KEY = "sugar.v8.emailVerified";
const PROVIDER_KEY = "sugar.v8.authProvider";

export type ProtectedActionType =
  | "like-creator"
  | "buy-pack"
  | "open-pack"
  | "scratch-card"
  | "view-collection"
  | "view-rewards"
  | "view-profile"
  | "redeem-code"
  | "claim-reward"
  | "session-expired";

export type ProtectedAction =
  | { type: "buy"; pack: PurchaseFlowPack; kind?: "buy-pack" | "open-pack" }
  | { type: "like"; feedItemId: string }
  | { type: "tab"; tab: AppTab }
  | { type: "scratch" };

export type AuthenticationSheetMode =
  | "login"
  | "create-account"
  | "forgot-password"
  | "reset-sent";

export type AuthProvider = "google" | "apple" | "email";

export type AuthSuccessResult = {
  email: string;
  provider: AuthProvider;
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

export function createSession(email: string, provider: AuthProvider = "email") {
  const normalized = email.trim().toLowerCase();
  try {
    sessionStorage.setItem(AUTH_KEY, "1");
    sessionStorage.setItem(EMAIL_KEY, normalized);
    sessionStorage.setItem(PROVIDER_KEY, provider);
    localStorage.setItem(PROVIDER_KEY, provider);
  } catch {
    /* ignore */
  }
  if (provider === "google" || provider === "apple") {
    markEmailVerified();
  }
}

export function destroySession() {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
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

/** Prototype rule: at least 12 characters. */
export function isValidAuthPassword(pw: string) {
  return pw.length >= 12;
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

export function triggerFromAction(
  action: ProtectedAction | null,
): ProtectedActionType | undefined {
  if (!action) return undefined;
  if (action.type === "like") return "like-creator";
  if (action.type === "scratch") return "scratch-card";
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
