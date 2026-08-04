import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/server";
import { createSession } from "@/lib/auth/session";

/**
 * Creates an account, and signs in when the API returns a session.
 *
 * The same shape as the login route, and for the same reason: tokens arrive
 * here server-side and go straight into httpOnly cookies, so the browser never
 * holds them. A teacher registration comes back without a session — the account
 * is awaiting approval — and the caller is told so rather than signed in.
 */
export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body.", errorCode: "bad_request" },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    response = await fetch(new URL("/api/v1/auth/register", API_BASE_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardedFor(request),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Could not reach the server. Check your connection and try again.",
        errorCode: "network_error",
      },
      { status: 503 },
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload.data) {
    return NextResponse.json(
      payload ?? { success: false, message: "Registration failed.", errorCode: "bad_request" },
      { status: response.status },
    );
  }

  const { user, requiresApproval, session } = payload.data;

  if (session) {
    await createSession(session);
  }

  // Tokens are deliberately not echoed back: the client has no use for them and
  // no way to store them safely.
  return NextResponse.json({
    success: true,
    data: { user, requiresApproval },
    message: payload.message,
  });
}

function forwardedFor(request: NextRequest): Record<string, string> {
  const existing = request.headers.get("x-forwarded-for");
  return existing ? { "X-Forwarded-For": existing } : {};
}
