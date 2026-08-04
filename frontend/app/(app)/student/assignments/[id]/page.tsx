import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/server";
import type { StudentAssignmentDetail } from "@/lib/api/types";
import { AssignmentDetailView } from "./detail-view";

export const metadata: Metadata = { title: "Assignment" };

export default async function StudentAssignmentDetailPage({
  params,
}: {
  // Next 16: route params are async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const assignment = await api.get<StudentAssignmentDetail>(
      `/api/v1/student/assignments/${id}`,
    );

    return <AssignmentDetailView assignment={assignment} />;
  } catch (error) {
    // The API returns 404 both for a missing assignment and for one belonging to
    // another class, so this page cannot confirm that either exists.
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }

    throw error;
  }
}
