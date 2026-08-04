import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { ClassDto, EnrollmentDto, PagedResult, UserDto } from "@/lib/api/types";
import { EnrollmentsView } from "./enrollments-view";

export const metadata: Metadata = { title: "Enrolments" };

export default async function AdminEnrollmentsPage() {
  const [initial, classes, students] = await Promise.all([
    api.get<PagedResult<EnrollmentDto>>("/api/v1/admin/enrollments", { pageSize: 20 }),
    api.get<PagedResult<ClassDto>>("/api/v1/admin/classes", { pageSize: 100, isActive: true }),
    api.get<PagedResult<UserDto>>("/api/v1/admin/users", {
      pageSize: 200,
      role: "Student",
      isActive: true,
      sortBy: "fullName",
    }),
  ]);

  return (
    <EnrollmentsView
      initial={initial}
      classes={classes.items}
      students={students.items}
    />
  );
}
