import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import { getSessionUser } from "@/lib/auth/session";
import type { StudentDashboard } from "@/lib/api/types";
import { StudentDashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboardPage() {
  // Fetched server-side, so the page arrives with its data rather than
  // rendering a skeleton and then filling in.
  const [dashboard, user] = await Promise.all([
    api.get<StudentDashboard>("/api/v1/student/dashboard"),
    getSessionUser(),
  ]);

  return <StudentDashboardView dashboard={dashboard} name={user?.fullName ?? ""} />;
}
