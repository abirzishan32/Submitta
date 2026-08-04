import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { AssignmentDto, OfferingOption, PagedResult } from "@/lib/api/types";
import { AssignmentsView } from "@/components/teacher/assignments-view";

export const metadata: Metadata = { title: "Assignments" };

/**
 * The admin's read-only view over every assignment — "view all assignments and
 * submissions" from the brief. The API already returns everything for an admin,
 * so this is the same component with creation turned off.
 */
export default async function AdminAssignmentsPage() {
  const [initial, offerings] = await Promise.all([
    api.get<PagedResult<AssignmentDto>>("/api/v1/assignments", {
      pageSize: 20,
      sortBy: "deadline",
    }),
    api.get<OfferingOption[]>("/api/v1/assignments/offerings"),
  ]);

  return (
    <AssignmentsView
      initial={initial}
      offerings={offerings}
      basePath="/admin"
      readOnly
    />
  );
}
