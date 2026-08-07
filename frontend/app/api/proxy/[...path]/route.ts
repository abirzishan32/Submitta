import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/server";
import {
  ACCESS_TOKEN_COOKIE,
  clearSession,
  createSession,
  getAccessToken,
  getRefreshToken,
} from "@/lib/auth/session";

/**
 * Authenticated proxy between client components and the API.
 *
 * Client code calls `/api/proxy/api/v1/...` and this attaches the bearer token
 * from the httpOnly cookie. That keeps tokens out of JavaScript entirely, and
 * puts refresh-on-401 in exactly one place instead of in every hook.
 */

const FORWARD_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  // Next 16: route params are async.
  const { path } = await context.params;

  const target = new URL(`/${path.join("/")}`, API_BASE_URL);
  target.search = request.nextUrl.search;

  const body =
    request.method === "GET" || request.method === "DELETE"
      ? undefined
      : await request.text();

  let response = await forward(target, request, body, await getAccessToken());

  // The access token is short-lived by design, so a 401 mid-session usually
  // just means it expired. Refresh once and retry before giving up on the user.
  if (response.status === 401) {
    const refreshed = await tryRefresh();

    if (refreshed) {
      response = await forward(target, request, body, refreshed);
    } else {
      await clearSession();
    }
  }

  const contentType = response.headers.get("Content-Type") ?? "application/json";

  // Anything that is not text has to be passed through as bytes. Reading a PDF
  // with text() decodes it as UTF-8 and silently mangles every byte that is not
  // valid there, producing a file that downloads but will not open.
  if (!isTextual(contentType)) {
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });

    // Carries the filename through to the browser's Save-As dialogue.
    const disposition = response.headers.get("Content-Disposition");
    if (disposition) headers.set("Content-Disposition", disposition);

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers,
    });
  }

  const payload = await response.text();

  return new NextResponse(payload || null, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

/** Whether a response body survives being read as a string. */
function isTextual(contentType: string): boolean {
  return /^(application\/(json|.*\+json)|text\/)/i.test(contentType);
}

async function forward(
  target: URL,
  request: NextRequest,
  body: string | undefined,
  token: string | null,
): Promise<Response> {
  try {
    return await fetch(target, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
    });
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Could not reach the server. Check your connection and try again.",
        errorCode: "network_error",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * Exchanges the refresh token for a new pair and rewrites the session cookies.
 * Returns the new access token, or null if the session is genuinely over.
 */
async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(new URL("/api/v1/auth/refresh", API_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = await response.json();
    if (!payload?.success || !payload.data) return null;

    await createSession(payload.data);
    return payload.data.accessToken as string;
  } catch {
    return null;
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

export { FORWARD_METHODS };
