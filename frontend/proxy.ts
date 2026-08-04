import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

/**
 * Route protection.
 *
 * Next.js 16 renamed `middleware` to `proxy`; the function export is renamed to
 * match. The runtime is Node and is not configurable.
 *
 * This is a first gate, not the security boundary. It only checks that a session
 * cookie exists — it does not verify the token, because the API does that on
 * every request and is the only place a role is trusted. Its job is to send a
 * signed-out visitor to the login page instead of rendering a dashboard that
 * would fail every data call.
 */

const ACCESS_TOKEN_COOKIE = "as_access";
const REFRESH_TOKEN_COOKIE = "as_refresh";
const USER_COOKIE = "as_user";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:5062";

/**
 * Reachable without a session. The marketing homepage lives at "/" and stays
 * visible to everyone, signed in or not — a signed-in visitor simply sees
 * "Go to dashboard" in its navigation instead of "Sign in".
 */
const PUBLIC_PATHS = ["/", "/login", "/register"];

/**
 * Public pages that a signed-in user has no reason to see, and is redirected
 * away from. The homepage is deliberately absent: bouncing someone off the
 * marketing site because they happen to be logged in is hostile.
 */
const AUTH_ONLY_PATHS = ["/login", "/register"];

/** Landing page per role, so each lands somewhere useful rather than a hub. */
const ROLE_HOME: Record<string, string> = {
  Admin: "/admin",
  Teacher: "/teacher",
  Student: "/student",
};

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  // Access tokens live 15 minutes, and a Server Component cannot set cookies
  // during render — so if one expires mid-session, every server-side data call
  // would 401 and crash the page. Refreshing here is the only place with both
  // the refresh token and the ability to write the new cookies.
  let refreshed: RefreshedSession | null = null;

  if (!isPublic && refreshToken && isExpired(accessToken)) {
    refreshed = await refreshSession(refreshToken);

    if (!refreshed) {
      // The refresh token is spent too: end the session cleanly rather than
      // letting the page fail.
      return clearSessionAndRedirect(request, pathname, search);
    }
  }

  const hasSession = Boolean(refreshed) || Boolean(accessToken);

  // Signed out and asking for a protected page: send to login, remembering
  // where they were headed so they land there afterwards.
  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    if (pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }

    return finalise(NextResponse.redirect(url), request, refreshed);
  }

  // Signed in and looking at the login page: nothing useful there.
  if (hasSession && AUTH_ONLY_PATHS.includes(pathname)) {
    return finalise(
      NextResponse.redirect(new URL(homeFor(request), request.url)),
      request,
      refreshed,
    );
  }

  // A refreshed access token has to reach this same request, not just the next
  // one — the page about to render is what needs it.
  if (refreshed) {
    const headers = new Headers(request.headers);
    const cookie = headers.get("cookie") ?? "";

    headers.set(
      "cookie",
      cookie
        .split(";")
        .filter((part) => !part.trim().startsWith(`${ACCESS_TOKEN_COOKIE}=`))
        .concat(`${ACCESS_TOKEN_COOKIE}=${refreshed.accessToken}`)
        .join("; "),
    );

    return finalise(
      NextResponse.next({ request: { headers } }),
      request,
      refreshed,
    );
  }

  return finalise(NextResponse.next(), request, null);
}

/**
 * Reads the role from the (non-httpOnly) user cookie purely to choose a landing
 * page. Tampering with it changes nothing beyond which page renders first —
 * every endpoint behind it re-checks the role from the signed token.
 */
function homeFor(request: NextRequest): string {
  const raw = request.cookies.get(USER_COOKIE)?.value;
  if (!raw) return "/student";

  try {
    const user = JSON.parse(decodeURIComponent(raw)) as { role?: string };
    return ROLE_HOME[user.role ?? ""] ?? "/student";
  } catch {
    return "/student";
  }
}

interface RefreshedSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: unknown;
}

/**
 * Whether a JWT is expired (or unreadable).
 *
 * Only the `exp` claim is read, and the signature is deliberately not checked —
 * that is the API's job. This is purely "should we bother refreshing?". A
 * 30-second margin avoids handing the API a token that expires in flight.
 */
function isExpired(token: string | undefined): boolean {
  if (!token) return true;

  try {
    const [, payload] = token.split(".");
    if (!payload) return true;

    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    ) as { exp?: number };

    if (typeof decoded.exp !== "number") return true;

    return decoded.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  try {
    const response = await fetch(new URL("/api/v1/auth/refresh", API_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = await response.json();
    return payload?.success && payload.data ? (payload.data as RefreshedSession) : null;
  } catch {
    // The API being unreachable is not a reason to destroy the session.
    return null;
  }
}

function clearSessionAndRedirect(
  request: NextRequest,
  pathname: string,
  search: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";

  if (pathname !== "/") {
    url.searchParams.set("next", `${pathname}${search}`);
  }

  const response = NextResponse.redirect(url);

  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_COOKIE]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return withLocale(response, request);
}

/** Writes refreshed session cookies, then ensures a locale cookie exists. */
function finalise(
  response: NextResponse,
  request: NextRequest,
  refreshed: RefreshedSession | null,
): NextResponse {
  if (refreshed) {
    const expires = new Date(refreshed.refreshTokenExpiresAt);
    const secure = process.env.NODE_ENV === "production";

    response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, {
      httpOnly: true, secure, sameSite: "lax", path: "/", expires,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refreshToken, {
      httpOnly: true, secure, sameSite: "lax", path: "/", expires,
    });
    response.cookies.set(
      USER_COOKIE,
      encodeURIComponent(JSON.stringify(refreshed.user)),
      { httpOnly: false, secure, sameSite: "lax", path: "/", expires },
    );
  }

  return withLocale(response, request);
}

/**
 * Ensures a locale cookie exists, so the very first server render already knows
 * which dictionary to use instead of flashing English and then switching.
 */
function withLocale(response: NextResponse, request: NextRequest): NextResponse {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;

  if (!isLocale(existing)) {
    response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  /*
   * Everything except Next's own assets, the API routes (which authenticate
   * themselves) and static files.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
