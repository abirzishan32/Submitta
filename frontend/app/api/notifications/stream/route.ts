import { NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/api/server";
import { getAccessToken } from "@/lib/auth/session";

/**
 * Proxies the API's notification stream to the browser.
 *
 * The browser cannot open the stream itself: the access token lives in an
 * httpOnly cookie by design, and `EventSource` cannot set an Authorization
 * header. So the connection terminates here, where the token is readable, and
 * the body is piped straight through — the same arrangement every other API
 * call in this app uses, just held open.
 *
 * Node runtime rather than edge, because it needs the cookie helpers and a
 * long-lived upstream connection.
 */
export const runtime = "nodejs";

// Nothing about a live stream can be cached or statically rendered.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getAccessToken();

  if (!token) {
    return new Response("Not authenticated", { status: 401 });
  }

  let upstream: Response;

  try {
    upstream = await fetch(new URL("/api/v1/notifications/stream", API_BASE_URL), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      // Tied to the browser's connection: when the tab closes, this aborts and
      // the API sees the disconnect rather than holding a subscription open.
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream unavailable", { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Stream unavailable", { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops a reverse proxy from buffering the stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}
