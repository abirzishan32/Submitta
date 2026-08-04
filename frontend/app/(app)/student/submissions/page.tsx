import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { PagedResult, StudentSubmission } from "@/lib/api/types";
import { SubmissionsView } from "./submissions-view";

export const metadata: Metadata = { title: "My submissions" };

export default async function StudentSubmissionsPage() {
  const initial = await api.get<PagedResult<StudentSubmission>>(
    "/api/v1/student/submissions",
    { pageSize: 20 },
  );

  return <SubmissionsView initial={initial} />;
}
