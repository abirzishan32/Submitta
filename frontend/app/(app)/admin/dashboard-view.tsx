"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, GraduationCap, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { AssignmentStatusBadge } from "@/components/common/status-badge";
import { Stagger, FadeInUp } from "@/components/motion/primitives";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative } from "@/lib/format";
import type { AssignmentDto, ClassDto } from "@/lib/api/types";

export function AdminDashboardView({
  counts,
  recentClasses,
  recentAssignments,
  name,
}: {
  counts: {
    users: number;
    teachers: number;
    students: number;
    classes: number;
    subjects: number;
    assignments: number;
  };
  recentClasses: ClassDto[];
  recentAssignments: AssignmentDto[];
  name: string;
}) {
  const { t, tx, locale, n } = useTranslation();
  const firstName = name.split(" ")[0] ?? name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx(t.dashboard.welcome, { name: firstName })}
        description={t.dashboard.overview}
        actions={
          <Button render={<Link href="/admin/users" />}>
            <Plus className="size-4" aria-hidden />
            {t.users.newUser}
          </Button>
        }
      />

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t.dashboard.totalUsers}
          value={n(counts.users)}
          hint={`${n(counts.teachers)} ${t.roles.Teacher} · ${n(counts.students)} ${t.roles.Student}`}
          icon={Users}
        />
        <StatCard label={t.dashboard.totalClasses} value={n(counts.classes)} icon={GraduationCap} />
        <StatCard label={t.dashboard.totalSubjects} value={n(counts.subjects)} icon={BookOpen} />
        <StatCard
          label={t.dashboard.totalAssignments}
          value={n(counts.assignments)}
          icon={ClipboardList}
        />
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeInUp delay={0.08} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.classes.title}</h2>
            <Link
              href="/admin/classes"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              {t.common.viewDetails}
            </Link>
          </div>

          {recentClasses.length === 0 ? (
            <EmptyState icon={GraduationCap} title={t.classes.empty} />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {recentClasses.map((klass) => (
                <Link
                  key={klass.id}
                  href={`/admin/classes?search=${encodeURIComponent(klass.code)}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{klass.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {klass.code}
                      {klass.academicYear ? ` · ${klass.academicYear}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {n(klass.enrolledStudentCount)} {t.classes.students.toLowerCase()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </FadeInUp>

        <FadeInUp delay={0.12} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.assignments.title}</h2>
            <Link
              href="/admin/assignments"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              {t.common.viewDetails}
            </Link>
          </div>

          {recentAssignments.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t.assignments.empty} />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {recentAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{assignment.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {assignment.classCode} · {assignment.subjectName} ·{" "}
                      {formatRelative(assignment.createdAt, locale)}
                    </p>
                  </div>
                  <AssignmentStatusBadge status={assignment.status} />
                </div>
              ))}
            </div>
          )}
        </FadeInUp>
      </div>
    </div>
  );
}
