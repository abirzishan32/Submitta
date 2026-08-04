import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { ClassOption, PagedResult, StudentAssignment, SubjectOption } from "@/lib/api/types";
import { StudentAssignmentsView } from "./assignments-view";

export const metadata: Metadata = { title: "Assignments" };

export default async function StudentAssignmentsPage() {
  const [initial, classes, subjects] = await Promise.all([
    api.get<PagedResult<StudentAssignment>>("/api/v1/student/assignments", {
      pageSize: 20,
      sortBy: "deadline",
    }),
    api.get<ClassOption[]>("/api/v1/student/classes"),
    api.get<SubjectOption[]>("/api/v1/student/subjects"),
  ]);

  return (
    <StudentAssignmentsView initial={initial} classes={classes} subjects={subjects} />
  );
}
