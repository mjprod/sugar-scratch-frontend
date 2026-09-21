/**
 * v8 Adaptive Recommendation Engine — cold-start initialization only.
 * Auth never decides recommendation. This module is the sole launcher.
 */

import { type ProtectedAction } from "./auth";

const STATUS_KEY = "sugar.v8.recommendationStatus";
const DEFER_KEY = "sugar.v8.recommendationDeferredSession";
const SEED_CREATOR_KEY = "sugar.v8.recSeedCreator";
const STRONG_SIGNAL_KEY = "sugar.v8.strongBehaviourSignal";
const SWIPE_PREFS_KEY = "sugar.v8.swipePrefs";
const ENGAGE_KEY = "sugar.v8.creatorEngage";

/** Spec §34 — configurable card count. */
export const MIN_PERSONALIZATION_CARDS = 6;

export type RecommendationStatus =
  | "unknown"
  | "eligible"
  | "explicit-in-progress"
  | "explicit-completed"
  | "behavior-seeded"
  | "skipped";

export type RecommendationDecision =
  | { action: "none" }
  | { action: "resume" }
  | { action: "launch-initialization" }
  | { action: "seed-and-resume" };

export type RecommendationCard = {
  id: string;
  creatorId: string;
  name: string;
  theme: string;
  tagline: string;
};

export const RECOMMENDATION_CARDS: RecommendationCard[] = [
  {
    id: "oc1",
    creatorId: "emily",
    name: "Emily",
    theme: "Cyber Nights",
    tagline: "Futuristic cosplay creator",
  },
  {
    id: "oc2",
    creatorId: "emily",
    name: "Emily",
    theme: "Office Collection",
    tagline: "Sharp silhouettes after hours",
  },
  {
    id: "oc3",
    creatorId: "ashley",
    name: "Ashley",
    theme: "Beach Vacation",
    tagline: "Sunlit premium photo packs",
  },
  {
    id: "oc4",
    creatorId: "nancy",
    name: "Nancy Allison",
    theme: "Kimono Glow",
    tagline: "Lifestyle drops with soft light",
  },
  {
    id: "oc5",
    creatorId: "alex",
    name: "Alex Rivera",
    theme: "Idol Stage",
    tagline: "Limited edition motion packs",
  },
  {
    id: "oc6",
    creatorId: "sam",
    name: "Sam Chen",
    theme: "Night Shift",
    tagline: "Neon fitness & street looks",
  },
  {
    id: "oc7",
    creatorId: "jordan",
    name: "Jordan Lee",
    theme: "Office After Hours",
    tagline: "Premium collector series",
  },
  {
    id: "oc8",
    creatorId: "riley",
    name: "Riley Brooks",
    theme: "Fantasy Realm",
    tagline: "Mage series with dust surprises",
  },
  {
    id: "oc9",
    creatorId: "casey",
    name: "Casey Morgan",
    theme: "Cafe Soft",
    tagline: "Warm daily creator drops",
  },
  {
    id: "oc10",
    creatorId: "taylor",
    name: "Taylor Quinn",
    theme: "Racing Pulse",
    tagline: "High-speed collector vault",
  },
  {
    id: "oc11",
    creatorId: "mina",
    name: "Mina Park",
    theme: "Student Days",
    tagline: "Campus aesthetic card sets",
  },
  {
    id: "oc12",
    creatorId: "nova",
    name: "Nova Blake",
    theme: "Samurai Neon",
    tagline: "Blade-edge cinematic packs",
  },
  {
    id: "oc13",
    creatorId: "emily",
    name: "Emily",
    theme: "Winter Glass",
    tagline: "Cool-tone seasonal exclusives",
  },
  {
    id: "oc14",
    creatorId: "ashley",
    name: "Ashley",
    theme: "Studio Light",
    tagline: "Portrait-first scratch cards",
  },
];

export function getRecommendationStatus(): RecommendationStatus {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (
      raw === "unknown" ||
      raw === "eligible" ||
      raw === "explicit-in-progress" ||
      raw === "explicit-completed" ||
      raw === "behavior-seeded" ||
      raw === "skipped"
    ) {
      return raw;
    }
    // Migrate v7 preference keys if present in same browser
    const legacy = localStorage.getItem("sugar.v8.preferenceStatus");
    if (
      legacy === "explicit-completed" ||
      legacy === "behavior-seeded" ||
      legacy === "skipped" ||
      legacy === "explicit-in-progress" ||
      legacy === "unknown"
    ) {
      localStorage.setItem(STATUS_KEY, legacy);
      return legacy;
    }
    if (localStorage.getItem("sugar.v8.personalizationCompleted") === "1") {
      localStorage.setItem(STATUS_KEY, "explicit-completed");
      return "explicit-completed";
    }
    if (localStorage.getItem("sugar.v8.meaningfulExperience") === "1") {
      localStorage.setItem(STATUS_KEY, "behavior-seeded");
      return "behavior-seeded";
    }
  } catch {
    /* ignore */
  }
  return "unknown";
}

export function setRecommendationStatus(status: RecommendationStatus) {
  try {
    localStorage.setItem(STATUS_KEY, status);
  } catch {
    /* ignore */
  }
}

export function isRecommendationInitialized() {
  const s = getRecommendationStatus();
  return s === "explicit-completed" || s === "behavior-seeded";
}

/** High-intent pending — never interrupt with Recommendation Initialization. */
export function isHighIntentPending(pending: ProtectedAction | null) {
  if (!pending) return false;
  if (pending.type === "buy") return true;
  if (pending.type === "tab" && pending.tab === "hub") return true;
  return false;
}

export function hasStrongBehaviourSignal() {
  try {
    if (localStorage.getItem(STRONG_SIGNAL_KEY) === "1") return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("strongSignal") === "1") {
      localStorage.setItem(STRONG_SIGNAL_KEY, "1");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function markStrongBehaviourSignal(creatorName?: string) {
  try {
    localStorage.setItem(STRONG_SIGNAL_KEY, "1");
    if (creatorName) setRecommendationSeedCreator(creatorName);
  } catch {
    /* ignore */
  }
}

export function markRecommendationBehaviorSeeded(creatorName?: string) {
  try {
    if (creatorName) setRecommendationSeedCreator(creatorName);
    setRecommendationStatus("behavior-seeded");
    sessionStorage.removeItem(DEFER_KEY);
  } catch {
    /* ignore */
  }
}

export function markRecommendationExplicitInProgress() {
  setRecommendationStatus("explicit-in-progress");
}

export function markRecommendationExplicitCompleted() {
  try {
    setRecommendationStatus("explicit-completed");
    sessionStorage.removeItem(DEFER_KEY);
  } catch {
    /* ignore */
  }
}

export function markRecommendationSkipped() {
  try {
    setRecommendationStatus("skipped");
    sessionStorage.setItem(DEFER_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isRecommendationDeferredThisSession() {
  try {
    return sessionStorage.getItem(DEFER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRecommendationSeedCreator(name: string) {
  try {
    sessionStorage.setItem(SEED_CREATOR_KEY, name);
  } catch {
    /* ignore */
  }
}

export function getRecommendationSeedCreator() {
  try {
    return sessionStorage.getItem(SEED_CREATOR_KEY) ?? "";
  } catch {
    return "";
  }
}

export function noteCreatorEngagement(creatorName: string) {
  const name = creatorName.trim();
  if (!name) return;
  try {
    const raw = sessionStorage.getItem(ENGAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[name] = (map[name] ?? 0) + 1;
    sessionStorage.setItem(ENGAGE_KEY, JSON.stringify(map));
    if (map[name] >= 3) setRecommendationSeedCreator(name);
  } catch {
    /* ignore */
  }
}

export function orderedRecommendationCards(
  seedName = getRecommendationSeedCreator(),
) {
  const seed = seedName.trim().toLowerCase();
  if (!seed) return [...RECOMMENDATION_CARDS];
  const primary = RECOMMENDATION_CARDS.filter(
    (c) => c.name.toLowerCase() === seed || c.creatorId.toLowerCase() === seed,
  );
  const rest = RECOMMENDATION_CARDS.filter(
    (c) => c.name.toLowerCase() !== seed && c.creatorId.toLowerCase() !== seed,
  );
  return [...primary, ...rest];
}

export function saveSwipePreferences(result: {
  liked: string[];
  passed: string[];
}) {
  try {
    localStorage.setItem(SWIPE_PREFS_KEY, JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

/**
 * Sole entry point that may launch Recommendation Initialization.
 * Spec §24 / §29 — evaluation order must not change.
 */
export function evaluateRecommendationEligibility(opts: {
  pending: ProtectedAction | null;
  /** True only after this login / confirmed session, not leftover sessionStorage. */
  authenticated: boolean;
}): RecommendationDecision {
  if (!opts.authenticated) return { action: "none" };

  const status = getRecommendationStatus();

  // Existing / already initialized
  if (status === "behavior-seeded" || status === "explicit-completed") {
    return { action: "resume" };
  }

  // High intent always wins — never launch Tinder
  if (isHighIntentPending(opts.pending)) {
    return { action: "resume" };
  }

  // Strong behaviour (demo flag or future purchase seed already applied)
  if (hasStrongBehaviourSignal()) {
    markRecommendationBehaviorSeeded(getRecommendationSeedCreator() || undefined);
    return { action: "seed-and-resume" };
  }

  // Skipped this session — do not reopen
  if (status === "skipped" && isRecommendationDeferredThisSession()) {
    return { action: "resume" };
  }

  // Cold start — launch Recommendation Initialization
  if (
    status === "unknown" ||
    status === "eligible" ||
    status === "skipped" ||
    status === "explicit-in-progress"
  ) {
    setRecommendationStatus("eligible");
    return { action: "launch-initialization" };
  }

  return { action: "resume" };
}

export function clearRecommendationState() {
  try {
    localStorage.removeItem(STATUS_KEY);
    localStorage.removeItem("sugar.v8.preferenceStatus");
    localStorage.removeItem("sugar.v8.personalizationCompleted");
    localStorage.removeItem("sugar.v8.meaningfulExperience");
    localStorage.removeItem("sugar.v8.personalizationSoftEligible");
    localStorage.removeItem(STRONG_SIGNAL_KEY);
    localStorage.removeItem(SWIPE_PREFS_KEY);
    sessionStorage.removeItem(DEFER_KEY);
    sessionStorage.removeItem(SEED_CREATOR_KEY);
    sessionStorage.removeItem(ENGAGE_KEY);
  } catch {
    /* ignore */
  }
}
