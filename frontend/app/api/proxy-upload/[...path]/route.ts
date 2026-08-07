import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/server";
import { getAccessToken } from "@/lib/auth/session";

/**
 * Forwards a file upload to the API.
 *
 * The ordinary proxy reads and re-serialises JSON, which would corrupt a binary
 * body and force a whole PDF through a string. This one streams the multipart
 * body through untouched and only attaches the token — which the browser cannot
 * do itself, because the token lives in an httpOnly cookie.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const token = await getAccessToken();

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Your session has expired.", errorCode: "unauthorized" },
      { status: 401 },
    );
  }

  const { path } = await params;
  const target = new URL(`/${path.join("/")}`, API_BASE_URL);

  let upstream: Response;

  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Passed through verbatim: it carries the multipart boundary, and
        // regenerating it would not match the body.
        "Content-Type": request.headers.get("content-type") ?? "",
      },
      body: request.body,
      // Required by undici when streaming a request body.
      duplex: "half",
      cache: "no-store",
    } as RequestInit & { duplex: "half" });
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

  const payload = await upstream.json().catch(() => null);

  return NextResponse.json(
    payload ?? { success: false, message: "Upload failed.", errorCode: "upload_failed" },
    { status: upstream.status },
  );
}
