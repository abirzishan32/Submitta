import type { Metadata } from "next";
import { API_BASE_URL } from "@/lib/api/server";
import { LoginView } from "./login-view";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  // Next 16: searchParams is async.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only same-origin paths are honoured, so a crafted ?next=https://evil.example
  // cannot turn the login page into an open redirect.
  const redirectTo =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return <LoginView redirectTo={redirectTo} registrationOpen={await isRegistrationOpen()} />;
}

/**
 * Whether to offer a link to the sign-up form.
 *
 * Read here rather than guessed, so a closed instance does not advertise a page
 * that only refuses. A failure to reach the API is treated as closed.
 */
async function isRegistrationOpen(): Promise<boolean> {
  try {
    const response = await fetch(
      new URL("/api/v1/auth/registration-options", API_BASE_URL),
      { cache: "no-store" },
    );

    const payload = await response.json();
    return Boolean(payload?.data?.selfRegistrationEnabled);
  } catch {
    return false;
  }
}
