import "server-only";

import { cookies } from "next/headers";
import type { UserProfile } from "@/lib/api/types";

/**
 * Session storage.
 *
 * Tokens are held in httpOnly cookies, so no script on the page — ours or an
 * injected one — can read them. That is also why client components never call
 * the API directly: they go through the server-side proxy, which attaches the
 * token for them.
 */

export const ACCESS_TOKEN_COOKIE = "as_access";
export const REFRESH_TOKEN_COOKIE = "as_refresh";
/** Readable by scripts on purpose: the UI needs the role to render navigation. */
export const USER_COOKIE = "as_user";

const isProduction = process.env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  secure: isProduction,
  // "lax" still sends the cookie on top-level navigation, which is what makes a
  // bookmarked dashboard URL work, while blocking cross-site form posts.
  sameSite: "lax" as const,
  path: "/",
};

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: UserProfile;
}

export async function createSession(tokens: SessionTokens): Promise<void> {
  const store = await cookies();

  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookie,
    expires: new Date(tokens.refreshTokenExpiresAt),
  });

  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    expires: new Date(tokens.refreshTokenExpiresAt),
  });

  // Not httpOnly: this is display data the client needs, and it carries no
  // authority — the API re-derives the role from the signed token on every call.
  store.set(USER_COOKIE, encodeURIComponent(JSON.stringify(tokens.user)), {
    ...baseCookie,
    httpOnly: false,
    expires: new Date(tokens.refreshTokenExpiresAt),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();

  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_COOKIE]) {
    store.set(name, "", { ...baseCookie, httpOnly: name !== USER_COOKIE, maxAge: 0 });
  }
}

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

/**
 * The signed-in user as recorded at sign-in.
 *
 * Convenient for rendering, but never a basis for an authorization decision —
 * those belong to the API, which reads the role from the token signature.
 */
export async function getSessionUser(): Promise<UserProfile | null> {
  const raw = (await cookies()).get(USER_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw)) as UserProfile;
  } catch {
    // A malformed cookie means no session, not a crashed page.
    return null;
  }
}
