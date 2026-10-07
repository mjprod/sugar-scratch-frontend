/**
 * Sign in with Apple JS — popup flow for our custom Apple button.
 * Apple receives sha256(nonce); the API receives the raw nonce plus the ID
 * token and checks that they match, so a leaked token cannot be replayed.
 */
import { APPLE_CLIENT_ID, APPLE_REDIRECT_URI } from "@/env";

const APPLE_SCRIPT_SRC =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
const APPLE_SCOPES = "name email";
const NONCE_BYTES = 32;
const CANCEL_ERRORS = new Set(["popup_closed_by_user", "user_cancelled_authorize"]);

type AppleSignInResponse = {
  authorization?: { code?: string; id_token?: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};

type AppleIDAuth = {
  init: (config: {
    clientId: string;
    scope: string;
    redirectURI: string;
    state: string;
    nonce: string;
    usePopup: boolean;
  }) => void;
  signIn: () => Promise<AppleSignInResponse>;
};

declare global {
  interface Window {
    AppleID?: { auth?: AppleIDAuth };
  }
}

export type AppleSignInFailure = "cancelled" | "unavailable" | "failed";

export class AppleSignInError extends Error {
  readonly reason: AppleSignInFailure;

  constructor(reason: AppleSignInFailure) {
    super(`apple_sign_in_${reason}`);
    this.reason = reason;
    this.name = "AppleSignInError";
  }
}

export type AppleSignInResult = {
  idToken: string;
  /** Raw nonce; Apple only saw its sha256. */
  nonce: string;
  /** Only present on the user's first authorization for this app. */
  name: string | null;
};

type NoncePair = { raw: string; hashed: string };

export const APPLE_LOGIN_ENABLED = APPLE_CLIENT_ID.length > 0;

let loadPromise: Promise<AppleIDAuth> | null = null;
/** Single-use nonce prepared ahead of the click so the popup opens synchronously. */
let preparedNonce: NoncePair | null = null;

function loadedAuth(): AppleIDAuth | null {
  return window.AppleID?.auth ?? null;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function createNonce(): Promise<NoncePair> {
  const raw = randomToken();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

function refillNonce(): Promise<NoncePair> {
  return createNonce().then((pair) => {
    preparedNonce = pair;
    return pair;
  });
}

function loadScript(): Promise<AppleIDAuth> {
  const ready = loadedAuth();
  if (ready) return Promise.resolve(ready);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<AppleIDAuth>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = APPLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const auth = loadedAuth();
      if (auth) resolve(auth);
      else reject(new AppleSignInError("unavailable"));
    };
    script.onerror = () => reject(new AppleSignInError("unavailable"));
    document.head.appendChild(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

/** Load the Apple script and a nonce; safe to call repeatedly (e.g. when the auth sheet opens). */
export function loadAppleIdentity(): Promise<AppleIDAuth> {
  if (!preparedNonce) void refillNonce().catch(() => undefined);
  return loadScript();
}

function fullName(user: AppleSignInResponse["user"]): string | null {
  const parts = [user?.name?.firstName, user?.name?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function signInWith(auth: AppleIDAuth, nonce: NoncePair): Promise<AppleSignInResult> {
  const state = randomToken();
  auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: APPLE_SCOPES,
    redirectURI: APPLE_REDIRECT_URI || window.location.origin,
    state,
    nonce: nonce.hashed,
    usePopup: true,
  });
  return auth.signIn().then(
    (response) => {
      const idToken = response.authorization?.id_token;
      if (!idToken || response.authorization?.state !== state) {
        throw new AppleSignInError("failed");
      }
      return { idToken, nonce: nonce.raw, name: fullName(response.user) };
    },
    (error: unknown) => {
      const code = (error as { error?: string } | null)?.error ?? "";
      throw new AppleSignInError(CANCEL_ERRORS.has(code) ? "cancelled" : "failed");
    },
  );
}

/**
 * Open the Apple sign-in popup and resolve with a verified-at-the-API ID token.
 * Call directly from a click handler: when the script and nonce are preloaded
 * the popup opens synchronously inside the user gesture, which Safari requires.
 */
export function requestAppleSignIn(): Promise<AppleSignInResult> {
  if (!APPLE_LOGIN_ENABLED) {
    return Promise.reject(new AppleSignInError("unavailable"));
  }
  const ready = loadedAuth();
  const nonce = preparedNonce;
  preparedNonce = null;

  const attempt =
    ready && nonce
      ? signInWith(ready, nonce)
      : Promise.all([loadScript(), nonce ? Promise.resolve(nonce) : createNonce()])
          .catch(() => {
            throw new AppleSignInError("unavailable");
          })
          .then(([auth, pair]) => signInWith(auth, pair));

  return attempt.finally(() => {
    void refillNonce().catch(() => undefined);
  });
}
