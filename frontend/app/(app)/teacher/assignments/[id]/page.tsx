import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/server";
import type { AssignmentDetail, AssignmentSubmissions } from "@/lib/api/types";
import { AssignmentDetailView } from "@/components/teacher/assignment-detail-view";

export const metadata: Metadata = { title: "Assignment" };

export default async function TeacherAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const assignment = await api.get<AssignmentDetail>(`/api/v1/assignments/${id}`);

    // A draft has no submissions and no grading view to show.
    const submissions =
      assignment.status === "Draft"
        ? null
        : await api.get<AssignmentSubmissions>(
            `/api/v1/grading/assignments/${id}/submissions`,
          );

    return (
      <AssignmentDetailView
        assignment={assignment}
        submissions={submissions}
        basePath="/teacher"
      />
    );
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.isForbidden)) {
      notFound();
    }

    throw error;
  }
}
