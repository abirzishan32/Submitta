import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/server";
import type { SubmissionDetail } from "@/lib/api/types";
import { GradeSubmissionView } from "@/app/(app)/teacher/grading/[submissionId]/grade-view";

export const metadata: Metadata = { title: "Submission" };

/**
 * One submission, read by an administrator.
 *
 * The same screen a teacher marks on. An administrator can mark too — the API
 * allows it, and someone has to be able to when a teacher is unavailable.
 */
export default async function AdminSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  try {
    const submission = await api.get<SubmissionDetail>(
      `/api/v1/grading/submissions/${submissionId}`,
    );

    return <GradeSubmissionView submission={submission} backHref="/admin/submissions" />;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }
}
