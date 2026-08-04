import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/server";
import { clearSession, getRefreshToken } from "@/lib/auth/session";

/**
 * Signs out.
 *
 * Revokes the refresh token server-side, then clears the cookies. The local
 * cookies are cleared regardless of whether the API call succeeds — a user who
 * asked to sign out must end up signed out of this browser either way.
 */
export async function POST() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(new URL("/api/v1/auth/logout", API_BASE_URL), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
    } catch {
      // The session is ending locally whatever the server says.
    }
  }

  await clearSession();

  return NextResponse.json({ success: true, message: "Signed out." });
}
