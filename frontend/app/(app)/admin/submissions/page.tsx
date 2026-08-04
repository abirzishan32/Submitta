import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { OfferingOption, PagedResult, SubmissionSummary } from "@/lib/api/types";
import { GradingQueueView } from "@/app/(app)/teacher/grading/grading-queue-view";

export const metadata: Metadata = { title: "All submissions" };

/**
 * Every submission in the system, for the administrator's oversight duty.
 *
 * The same queue a teacher sees, and deliberately the same component — the API
 * already widens the result set for an administrator, so a second screen would
 * only be a second place for the columns to drift.
 */
export default async function AdminSubmissionsPage() {
  const [initial, offerings] = await Promise.all([
    api.get<PagedResult<SubmissionSummary>>("/api/v1/grading/submissions", {
      pageSize: 20,
      sortBy: "submittedAt",
    }),
    api.get<OfferingOption[]>("/api/v1/assignments/offerings"),
  ]);

  return (
    <GradingQueueView
      initial={initial}
      offerings={offerings}
      basePath="/admin/submissions"
    />
  );
}
