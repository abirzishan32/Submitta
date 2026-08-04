import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { PagedResult, SubjectDto } from "@/lib/api/types";
import { SubjectsView } from "./subjects-view";

export const metadata: Metadata = { title: "Subjects" };

export default async function AdminSubjectsPage() {
  const initial = await api.get<PagedResult<SubjectDto>>("/api/v1/admin/subjects", {
    pageSize: 20,
    sortBy: "name",
  });

  return <SubjectsView initial={initial} />;
}
