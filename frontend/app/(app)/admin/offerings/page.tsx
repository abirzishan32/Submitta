import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type {
  ClassDto,
  OfferingDto,
  PagedResult,
  SubjectDto,
  UserDto,
} from "@/lib/api/types";
import { OfferingsView } from "./offerings-view";

export const metadata: Metadata = { title: "Class subjects" };

export default async function AdminOfferingsPage() {
  // Reference data for the pickers is fetched alongside the list, so opening a
  // dialog never has to wait on its own request.
  const [initial, classes, subjects, teachers] = await Promise.all([
    api.get<PagedResult<OfferingDto>>("/api/v1/admin/offerings", { pageSize: 20 }),
    api.get<PagedResult<ClassDto>>("/api/v1/admin/classes", { pageSize: 100, isActive: true }),
    api.get<PagedResult<SubjectDto>>("/api/v1/admin/subjects", { pageSize: 100, isActive: true }),
    api.get<PagedResult<UserDto>>("/api/v1/admin/users", {
      pageSize: 100,
      role: "Teacher",
      isActive: true,
    }),
  ]);

  return (
    <OfferingsView
      initial={initial}
      classes={classes.items}
      subjects={subjects.items}
      teachers={teachers.items}
    />
  );
}
