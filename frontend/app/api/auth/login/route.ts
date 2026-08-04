import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/server";
import { createSession } from "@/lib/auth/session";

/**
 * Signs in and establishes the session.
 *
 * The browser never sees the tokens: they arrive here server-side and go
 * straight into httpOnly cookies. Only the user profile is returned.
 */
export async function POST(request: NextRequest) {
  let credentials: unknown;

  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body.", errorCode: "bad_request" },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    response = await fetch(new URL("/api/v1/auth/login", API_BASE_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Preserved so the API records the real client against the session
        // rather than this server's address.
        ...forwardedFor(request),
      },
      body: JSON.stringify(credentials),
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
      payload ?? { success: false, message: "Sign-in failed.", errorCode: "unauthorized" },
      { status: response.status },
    );
  }

  await createSession(payload.data);

  // Deliberately excludes the tokens — the client has no use for them and no
  // way to store them safely.
  return NextResponse.json({
    success: true,
    data: { user: payload.data.user },
    message: payload.message,
  });
}

function forwardedFor(request: NextRequest): Record<string, string> {
  const existing = request.headers.get("x-forwarded-for");
  return existing ? { "X-Forwarded-For": existing } : {};
}
