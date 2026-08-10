export type Step =
  | "loading"
  | "splash"
  | "sign-in"
  | "create-account"
  | "verify-email"
  | "create-username"
  | "complete-profile"
  | "forgot-password"
  | "reset-password"
  | "recommend-intro"
  | "personalize-swipe"
  | "personalize-complete"
  | "pref-gender"
  | "pref-intro"
  | "pref-swipe"
  | "welcome-reward"
  | "app";

export type AppTab = "home" | "feed" | "hub" | "bag" | "profile";

/** Full-screen destinations from Top Navigation (hide footer while open) */
export type AppOverlay = "settings" | "store" | "inbox" | null;

export type GenderInterest = "male" | "female" | "both";

export type OnboardingData = {
  email: string;
  password: string;
  username: string;
  displayName: string;
  avatar: string | null;
  genderInterest: GenderInterest | null;
  likedCreators: string[];
  passedCreators: string[];
  welcomeClaimed: boolean;
  referralCode: string;
  referralApplied: boolean;
  homeTutorialDone: boolean;
  coins: number;
  diamonds: number;
};

export const STEP_LABEL: Record<Step, string> = {
  loading: "Loading",
  splash: "Splash Hook",
  "sign-in": "Login",
  "create-account": "Sign Up · 1",
  "verify-email": "Sign Up · 2",
  "create-username": "Sign Up · 3",
  "complete-profile": "Complete Profile",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  "recommend-intro": "Recommend · Intro",
  "personalize-swipe": "Recommend · Swipe",
  "personalize-complete": "Recommend · Ready",
  "pref-gender": "Preference · Gender",
  "pref-intro": "Preference · Intro",
  "pref-swipe": "Preference · Swipe",
  "welcome-reward": "Welcome Reward",
  app: "App",
};

export const SPLASH_SLIDES = [
  {
    title: "Sugar Scratch",
    hook: "Collect beauty cards from real creators and AI characters.",
    cta: "Next",
  },
  {
    title: "Scratch. Collect. Win.",
    hook: "Open packs, scratch to reveal, and earn Sugar Coins along the way.",
    cta: "Next",
  },
  {
    title: "Your collection awaits",
    hook: "Browse, streak daily rewards, and chase the cards you want most.",
    cta: "Get started",
  },
] as const;

export const GENDER_OPTIONS: { id: GenderInterest; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "both", label: "Both" },
];

export const DEMO_CREATORS = [
  { id: "c1", name: "Nancy Allison", tag: "Lifestyle · Daily drops" },
  { id: "c2", name: "Jane Smith", tag: "Premium photo packs" },
  { id: "c3", name: "Alex Rivera", tag: "Limited editions" },
  { id: "c4", name: "Sam Chen", tag: "Weekend bonuses" },
  { id: "c5", name: "Jordan Lee", tag: "Collector series" },
  { id: "c6", name: "Riley Brooks", tag: "Coin surprise packs" },
  { id: "c7", name: "Casey Morgan", tag: "Featured weekly" },
  { id: "c8", name: "Taylor Quinn", tag: "VIP scratch vault" },
] as const;

/** Configurable minimum preference swipes (spec: currently 5) */
export const MIN_PREF_SWIPES = 5;

export const TAKEN_USERNAMES = new Set(["taken", "admin", "sugar", "test"]);

export const AVATAR_OPTIONS = ["🌹", "✨", "💎", "🔥", "💋", "🌙"] as const;

export const WELCOME_REWARDS = [
  { id: "r1", label: "Starter Scratch Pack", detail: "1 pack" },
  { id: "r2", label: "Sugar Coins", detail: "+50" },
  { id: "r3", label: "Daily Streak Boost", detail: "Day 1 locked in" },
] as const;

export function isValidPassword(pw: string) {
  return (
    pw.length >= 6 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function suggestUsernames(seed: string) {
  const base =
    (seed || "alexsmi").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) ||
    "alexsmi";
  return [
    `${base}45760`,
    `smi${base.slice(0, 4)}81472`,
    `ale${base.slice(0, 3)}4448`,
    `smiale71043`,
    `${base}83073`,
  ];
}

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
    localStorage.removeItem("sugar.v8.strongBehaviourSignal");
    sessionStorage.removeItem("sugar.v8.personaBlockUntilNav");
    sessionStorage.removeItem("sugar.v8.personaSeedCreator");
    sessionStorage.removeItem("sugar.v8.recSeedCreator");
    sessionStorage.removeItem("sugar.v8.personalizationDeferredSession");
    sessionStorage.removeItem("sugar.v8.recommendationDeferredSession");
  } catch {
    /* ignore */
  }
}
