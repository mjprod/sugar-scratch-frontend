/** Public env — optional absolute API origin for production builds. */
const viteEnv =
  typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    : undefined;

export const API_BASE_URL = viteEnv?.VITE_API_BASE_URL ?? "";
export const STUB_OAUTH_ENABLED = viteEnv?.VITE_STUB_OAUTH === "1";
