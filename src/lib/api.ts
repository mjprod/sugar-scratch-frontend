import { API_BASE_URL } from "@/env";

const DEFAULT_TIMEOUT_MS = 6_000;

function resolveUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = API_BASE_URL.trim().replace(/\/+$/, "");
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return base ? `${base}${normalized}` : normalized;
}

/**
 * Fail-soft JSON GET/POST helper for live `/api/*` calls.
 * Returns null on network errors, abort, or non-OK responses.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const { signal: userSignal, ...rest } = init;
    if (userSignal) {
      if (userSignal.aborted) {
        controller.abort();
      } else {
        userSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    const response = await fetch(resolveUrl(path), {
      cache: "no-store",
      ...rest,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
