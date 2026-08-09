/** Public env — add VITE_* vars here as the backend lands. */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
