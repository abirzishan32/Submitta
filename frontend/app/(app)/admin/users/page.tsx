import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { PagedResult, UserDto } from "@/lib/api/types";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const initial = await api.get<PagedResult<UserDto>>("/api/v1/admin/users", {
    pageSize: 20,
    sortBy: "fullName",
  });

  return <UsersView initial={initial} />;
}
