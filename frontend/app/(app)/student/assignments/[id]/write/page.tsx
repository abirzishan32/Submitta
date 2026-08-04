import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/server";
import type { StudentAssignmentDetail } from "@/lib/api/types";
import type { EditorSession } from "@/lib/api/editor-types";
import { WriteView } from "./write-view";

export const metadata: Metadata = { title: "Write" };

export default async function WriteAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const assignment = await api.get<StudentAssignmentDetail>(
      `/api/v1/student/assignments/${id}`,
    );

    // A student who can neither submit nor edit has nothing to do here — the
    // detail page explains why, so send them back to it.
    if (!assignment.canSubmit && !assignment.canEdit) {
      notFound();
    }

    // Resume state, so a reopened editor continues the existing log instead of
    // starting a second timeline whose events the server would reject.
    const session = assignment.mySubmission
      ? await api.get<EditorSession>(
          `/api/v1/submissions/${assignment.mySubmission.id}/session`,
        )
      : null;

    return <WriteView assignment={assignment} session={session} />;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }
}
