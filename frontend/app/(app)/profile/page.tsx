import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { UserProfile } from "@/lib/api/types";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  // Read from the API rather than the session cookie, so this reflects the
  // server's current view of the account rather than a snapshot from sign-in.
  const profile = await api.get<UserProfile>("/api/v1/auth/me");

  return <ProfileView profile={profile} />;
}
