import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/server";
import type { AssignmentDetail, OfferingOption } from "@/lib/api/types";
import { AssignmentForm } from "@/components/teacher/assignment-form";

export const metadata: Metadata = { title: "Edit assignment" };

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [assignment, offerings] = await Promise.all([
      api.get<AssignmentDetail>(`/api/v1/assignments/${id}`),
      api.get<OfferingOption[]>("/api/v1/assignments/offerings"),
    ]);

    return (
      <AssignmentForm
        offerings={offerings}
        assignment={assignment}
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
