"use client";

import type { ApiResponse } from "./types";

/**
 * API client for client components.
 *
 * Requests go to the app's own proxy route rather than to the API directly, so
 * the bearer token stays in an httpOnly cookie and token refresh happens in one
 * server-side place.
 */

const PROXY_PREFIX = "/api/proxy";

export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ClientApiError";
  }

  /** Field errors flattened for react-hook-form's setError. */
  get fieldErrors(): Array<{ field: string; message: string }> {
    if (!this.errors) return [];

    return Object.entries(this.errors).flatMap(([field, messages]) =>
      messages.map((message) => ({
        // The API returns PascalCase property names; forms use camelCase.
        field: field.charAt(0).toLowerCase() + field.slice(1),
        message,
      })),
    );
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

function buildPath(path: string, params?: QueryParams): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  const search = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }
  }

  const query = search.toString();
  return `${PROXY_PREFIX}${normalised}${query ? `?${query}` : ""}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { params?: QueryParams } = {},
): Promise<T> {
  const { params, ...rest } = init;

  let response: Response;

  try {
    response = await fetch(buildPath(path, params), {
      ...rest,
      headers: { "Content-Type": "application/json", ...rest.headers },
    });
  } catch {
    throw new ClientApiError(
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
    if (!response.ok) {
      throw new ClientApiError(
        `Request failed with status ${response.status}.`,
        response.status,
      );
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ClientApiError(
      payload?.message ?? "Something went wrong. Please try again.",
      response.status,
      payload?.errorCode,
      payload?.errors,
    );
  }

  return payload?.data as T;
}

export const apiClient = {
  get: <T>(path: string, params?: QueryParams) =>
    request<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
