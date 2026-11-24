/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STUB_OAUTH?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URI?: string;
  readonly VITE_ENABLE_LABS?: string;
  /** Optional operator secret. Prefer the httpOnly cookie from /dashboard/login. */
  readonly VITE_DASHBOARD_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
