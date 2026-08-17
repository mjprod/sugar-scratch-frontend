/**
 * Session / onboarding flags (localStorage). Kept out of React layers.
 */

import { clearHasLoggedIn } from "@/services/auth";

const SEEN_KEY = "sugar.v8.hasEntered";
const ONBOARD_KEY = "sugar.v8.onboardingDone";

export function hasEnteredBefore() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markEntered() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isOnboardingDone() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARD_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearV8Session() {
  try {
    localStorage.removeItem(SEEN_KEY);
    localStorage.removeItem(ONBOARD_KEY);
    localStorage.removeItem("sugar.v8.recommendationStatus");
    localStorage.removeItem("sugar.v8.preferenceStatus");
    localStorage.removeItem("sugar.v8.personalizationCompleted");
    localStorage.removeItem("sugar.v8.meaningfulExperience");
    localStorage.removeItem("sugar.v8.requiredOnboardingStep");
    localStorage.removeItem("sugar.v8.personalizationSoftEligible");
    localStorage.removeItem("sugar.v8.emailVerified");
    localStorage.removeItem("sugar.v8.hasLoggedIn");
    localStorage.removeItem("sugar.v8.strongBehaviourSignal");
    sessionStorage.removeItem("sugar.v8.personaBlockUntilNav");
    sessionStorage.removeItem("sugar.v8.personaSeedCreator");
    sessionStorage.removeItem("sugar.v8.recSeedCreator");
    sessionStorage.removeItem("sugar.v8.personalizationDeferredSession");
    sessionStorage.removeItem("sugar.v8.recommendationDeferredSession");
    clearHasLoggedIn();
  } catch {
    /* ignore */
  }
}
