import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/server";
import type { OfferingOption } from "@/lib/api/types";
import { AssignmentForm } from "@/components/teacher/assignment-form";

export const metadata: Metadata = { title: "New assignment" };

export default async function NewAssignmentPage() {
  const offerings = await api.get<OfferingOption[]>("/api/v1/assignments/offerings");

  // Nothing to create work for — an empty picker would be a dead end, so send
  // them back to the list where the empty state explains why.
  if (offerings.length === 0) {
    redirect("/teacher/assignments");
  }

  return <AssignmentForm offerings={offerings} basePath="/teacher" />;
}
