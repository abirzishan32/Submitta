import "server-only";

import { getAccessToken } from "@/lib/auth/session";
import type { ApiResponse } from "./types";

/**
 * API client for Server Components and Route Handlers.
 *
 * Talks to the backend directly and reads the token from the httpOnly cookie,
 * so no token ever crosses into the browser.
 */

export const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:5062";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Query string parameters; null and undefined values are dropped. */
  params?: Record<string, string | number | boolean | null | undefined>;
}

export function buildUrl(
  path: string,
  params?: RequestOptions["params"],
): string {
  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    API_BASE_URL,
  );

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

/**
 * Performs a request and unwraps the API envelope.
 *
 * Failures throw {@link ApiError} carrying the status and field errors, so a
 * caller can `catch` once instead of checking `success` at every call site.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers, ...rest } = options;
  const token = await getAccessToken();

  let response: Response;

  try {
    response = await fetch(buildUrl(path, params), {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Dashboard data is per-user and changes constantly; caching it would
      // show one user's figures to the next.
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      "network_error",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    // A non-JSON body from an error status is still an error worth reporting.
    if (!response.ok) {
      throw new ApiError(
        `Request failed with status ${response.status}.`,
        response.status,
      );
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      payload?.errorCode,
      payload?.errors,
    );
  }

  return payload?.data as T;
}

/** Convenience wrappers, so call sites read as verbs. */
export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    apiFetch<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
