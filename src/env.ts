/** Public env — optional absolute API origin for production builds. */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
