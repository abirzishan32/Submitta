import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { OfferingOption, PagedResult, SubmissionSummary } from "@/lib/api/types";
import { GradingQueueView } from "./grading-queue-view";

export const metadata: Metadata = { title: "Grading" };

export default async function TeacherGradingPage() {
  const [initial, offerings] = await Promise.all([
    api.get<PagedResult<SubmissionSummary>>("/api/v1/grading/submissions", {
      pageSize: 20,
      sortBy: "submittedAt",
    }),
    api.get<OfferingOption[]>("/api/v1/assignments/offerings"),
  ]);

  return <GradingQueueView initial={initial} offerings={offerings} />;
}
