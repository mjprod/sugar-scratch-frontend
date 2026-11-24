import { API_BASE_URL } from "@/env";

export type UploadedFileInfo = {
  path: string;
  size_bytes: number;
};

/** Optional local override — prefer the httpOnly cookie from /api/auth/operator/login. */
const DASHBOARD_TOKEN =
  (import.meta.env.VITE_DASHBOARD_TOKEN as string | undefined)?.trim() || "";

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE_URL.trim().replace(/\/+$/, "");
  // Media (/models/…) stays same-origin so the Vite media proxy can serve it.
  if (base && normalized.startsWith("/api/")) return `${base}${normalized}`;
  return normalized;
}

export function dashboardAuthHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (DASHBOARD_TOKEN && !headers.has("X-Dashboard-Token")) {
    headers.set("X-Dashboard-Token", DASHBOARD_TOKEN);
  }
  return headers;
}

export async function operatorFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = dashboardAuthHeaders(init?.headers);
  if (!headers.has("Content-Type") && typeof init?.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  return fetch(resolveApiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await operatorFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function fetchOperatorSession(): Promise<boolean> {
  const response = await operatorFetch("/api/auth/operator/session");
  return response.ok;
}

export async function operatorLogin(token: string): Promise<void> {
  const response = await fetch(resolveApiUrl("/api/auth/operator/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error("Invalid dashboard token.");
    }
    if (response.status === 429) {
      throw new Error("Too many attempts — wait a few minutes and try again.");
    }
    throw new Error(text || response.statusText);
  }
}

export async function operatorLogout(): Promise<void> {
  await fetch(resolveApiUrl("/api/auth/operator/logout"), {
    method: "POST",
    credentials: "include",
  });
}
