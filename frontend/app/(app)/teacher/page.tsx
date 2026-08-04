import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import { getSessionUser } from "@/lib/auth/session";
import type {
  AssignmentDto,
  OfferingOption,
  PagedResult,
  SubmissionSummary,
} from "@/lib/api/types";
import { TeacherDashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function TeacherDashboardPage() {
  const [assignments, awaitingReview, offerings, user] = await Promise.all([
    api.get<PagedResult<AssignmentDto>>("/api/v1/assignments", {
      pageSize: 100,
    }),
    // Work that has been handed in but not yet marked — the one thing a teacher
    // opens a dashboard to find.
    api.get<PagedResult<SubmissionSummary>>("/api/v1/grading/submissions", {
      status: "Submitted",
      pageSize: 5,
      sortBy: "submittedAt",
    }),
    api.get<OfferingOption[]>("/api/v1/assignments/offerings"),
    getSessionUser(),
  ]);

  return (
    <TeacherDashboardView
      assignments={assignments.items}
      awaitingReview={awaitingReview}
      offerings={offerings}
      name={user?.fullName ?? ""}
    />
  );
}
