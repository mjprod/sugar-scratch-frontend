/**
 * Google Identity Services — popup auth-code flow for our custom Google button.
 * The API exchanges the returned code (redirect_uri "postmessage") for an ID token.
 */
import { GOOGLE_CLIENT_ID } from "@/env";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_SCOPES = "openid email profile";

type CodeResponse = {
  code?: string;
  error?: string;
  error_description?: string;
};

type CodeClientError = {
  type: "popup_closed" | "popup_failed_to_open" | "unknown";
  message?: string;
};

type CodeClient = { requestCode: () => void };

type GoogleOAuth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: "popup";
    redirect_uri?: string;
    select_account?: boolean;
    callback: (response: CodeResponse) => void;
    error_callback?: (error: CodeClientError) => void;
  }) => CodeClient;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export type GoogleSignInFailure = "cancelled" | "unavailable" | "failed";

export class GoogleSignInError extends Error {
  readonly reason: GoogleSignInFailure;

  constructor(reason: GoogleSignInFailure) {
    super(`google_sign_in_${reason}`);
    this.reason = reason;
    this.name = "GoogleSignInError";
  }
}

export const GOOGLE_LOGIN_ENABLED = GOOGLE_CLIENT_ID.length > 0;

let loadPromise: Promise<GoogleOAuth2> | null = null;

function loadedOAuth2(): GoogleOAuth2 | null {
  return window.google?.accounts?.oauth2 ?? null;
}

/** Inject the GIS script once; safe to call repeatedly (e.g. when the auth sheet opens). */
export function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  const ready = loadedOAuth2();
  if (ready) return Promise.resolve(ready);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const oauth2 = loadedOAuth2();
      if (oauth2) resolve(oauth2);
      else reject(new GoogleSignInError("unavailable"));
    };
    script.onerror = () => reject(new GoogleSignInError("unavailable"));
    document.head.appendChild(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

function requestWith(
  oauth2: GoogleOAuth2,
  resolve: (code: string) => void,
  reject: (error: GoogleSignInError) => void,
) {
  const client = oauth2.initCodeClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    ux_mode: "popup",
    select_account: true,
    callback: (response) => {
      if (response.code) resolve(response.code);
      else if (response.error === "access_denied") reject(new GoogleSignInError("cancelled"));
      else reject(new GoogleSignInError("failed"));
    },
    error_callback: (error) => {
      reject(
        new GoogleSignInError(error.type === "popup_closed" ? "cancelled" : "failed"),
      );
    },
  });
  client.requestCode();
}

/**
 * Open the Google account chooser and resolve with an auth code.
 * Call directly from a click handler: when GIS is preloaded the popup opens
 * synchronously inside the user gesture, which mobile popup blockers require.
 */
export function requestGoogleCode(): Promise<string> {
  if (!GOOGLE_LOGIN_ENABLED) {
    return Promise.reject(new GoogleSignInError("unavailable"));
  }
  return new Promise<string>((resolve, reject) => {
    const ready = loadedOAuth2();
    if (ready) {
      requestWith(ready, resolve, reject);
      return;
    }
    loadGoogleIdentity()
      .then((oauth2) => requestWith(oauth2, resolve, reject))
      .catch(() => reject(new GoogleSignInError("unavailable")));
  });
}
