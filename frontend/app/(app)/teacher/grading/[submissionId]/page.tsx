import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/server";
import type { SubmissionDetail } from "@/lib/api/types";
import { GradeSubmissionView } from "./grade-view";

export const metadata: Metadata = { title: "Grade submission" };

export default async function GradeSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  try {
    const submission = await api.get<SubmissionDetail>(
      `/api/v1/grading/submissions/${submissionId}`,
    );

    return <GradeSubmissionView submission={submission} />;
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.isForbidden)) {
      notFound();
    }

    throw error;
  }
}
