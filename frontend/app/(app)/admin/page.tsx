import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import { getSessionUser } from "@/lib/auth/session";
import type {
  AssignmentDto,
  ClassDto,
  PagedResult,
  SubjectDto,
  UserDto,
} from "@/lib/api/types";
import { AdminDashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  // pageSize 1 everywhere the count is all we need — totalCount comes back
  // regardless, so there is no reason to transfer the rows.
  const [users, teachers, students, classes, subjects, assignments, user] =
    await Promise.all([
      api.get<PagedResult<UserDto>>("/api/v1/admin/users", { pageSize: 1 }),
      api.get<PagedResult<UserDto>>("/api/v1/admin/users", { pageSize: 1, role: "Teacher" }),
      api.get<PagedResult<UserDto>>("/api/v1/admin/users", { pageSize: 1, role: "Student" }),
      api.get<PagedResult<ClassDto>>("/api/v1/admin/classes", { pageSize: 5 }),
      api.get<PagedResult<SubjectDto>>("/api/v1/admin/subjects", { pageSize: 1 }),
      api.get<PagedResult<AssignmentDto>>("/api/v1/assignments", {
        pageSize: 5,
        sortBy: "createdAt",
        sortDescending: true,
      }),
      getSessionUser(),
    ]);

  return (
    <AdminDashboardView
      counts={{
        users: users.totalCount,
        teachers: teachers.totalCount,
        students: students.totalCount,
        classes: classes.totalCount,
        subjects: subjects.totalCount,
        assignments: assignments.totalCount,
      }}
      recentClasses={classes.items}
      recentAssignments={assignments.items}
      name={user?.fullName ?? ""}
    />
  );
}
