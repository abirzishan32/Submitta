import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { ClassDto, PagedResult } from "@/lib/api/types";
import { ClassesView } from "./classes-view";

export const metadata: Metadata = { title: "Classes" };

export default async function AdminClassesPage() {
  const initial = await api.get<PagedResult<ClassDto>>("/api/v1/admin/classes", {
    pageSize: 20,
    sortBy: "name",
  });

  return <ClassesView initial={initial} />;
}
