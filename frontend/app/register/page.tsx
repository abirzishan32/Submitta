import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/server";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/navigation";
import { RegisterView } from "./register-view";

export const metadata: Metadata = { title: "Create an account" };

export interface RegistrationOptions {
  selfRegistrationEnabled: boolean;
  teacherRegistrationEnabled: boolean;
  teacherRequiresApproval: boolean;
  classes: Array<{ id: string; name: string; code: string; academicYear: string | null }>;
}

const CLOSED: RegistrationOptions = {
  selfRegistrationEnabled: false,
  teacherRegistrationEnabled: false,
  teacherRequiresApproval: true,
  classes: [],
};

/**
 * Sign-up.
 *
 * The options are read server-side so the form knows, before it renders,
 * whether registration is open and which classes exist — rather than flashing a
 * form that the API will refuse.
 */
export default async function RegisterPage() {
  // Someone already signed in has no use for this page.
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  let options = CLOSED;

  try {
    const response = await fetch(
      new URL("/api/v1/auth/registration-options", API_BASE_URL),
      { cache: "no-store" },
    );

    const payload = await response.json();
    if (payload?.success && payload.data) options = payload.data;
  } catch {
    // An unreachable API is reported by the form as a closed registration,
    // which is the safe reading: better to say "not now" than to collect a
    // password we cannot store.
  }

  return <RegisterView options={options} />;
}
