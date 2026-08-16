import { API_BASE_URL } from "../env";

const DEFAULT_TIMEOUT_MS = 6_000;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function resolveUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = API_BASE_URL.trim().replace(/\/+$/, "");
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return base ? `${base}${normalized}` : normalized;
}

async function request(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { signal: userSignal, headers, ...rest } = init;
    if (userSignal) {
      if (userSignal.aborted) controller.abort();
      else userSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return await fetch(resolveUrl(path), {
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(headers as Record<string, string> | undefined),
      },
      ...rest,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fail-soft JSON GET/POST helper for live `/api/*` calls.
 * Returns null on network errors, abort, or non-OK responses.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  try {
    const response = await request(path, init);
    if (!response.ok) return null;
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Strict helper for mutations — throws ApiError on non-OK. */
export async function apiMutate<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request(path, init, 15_000);
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : response.statusText;
    throw new ApiError(response.status, detail, body);
  }
  return body as T;
}
