"use client";

import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Stagger, FadeInUp } from "@/components/motion/primitives";
import { AssignmentDueRow } from "@/components/student/assignment-due-row";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatPercentage } from "@/lib/format";
import type { StudentDashboard } from "@/lib/api/types";

export function StudentDashboardView({
  dashboard,
  name,
}: {
  dashboard: StudentDashboard;
  name: string;
}) {
  const { t, tx, locale, n } = useTranslation();

  // Only the first name — a dashboard greeting reading "Welcome back, Nadia
  // Islam" sounds like a form letter.
  const firstName = name.split(" ")[0] ?? name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx(t.dashboard.welcome, { name: firstName })}
        description={t.dashboard.overview}
      />

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t.dashboard.pending}
          value={n(dashboard.pendingCount)}
          icon={ClipboardList}
          tone={dashboard.pendingCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t.dashboard.submitted}
          value={n(dashboard.submittedCount)}
          hint={`${t.common.of} ${n(dashboard.totalAssignments)}`}
          icon={CheckCircle2}
        />
        <StatCard
          label={t.dashboard.graded}
          value={n(dashboard.gradedCount)}
          icon={FileText}
          tone="success"
        />
        <StatCard
          label={
            dashboard.overdueCount > 0 ? t.dashboard.overdue : t.dashboard.averageMark
          }
          value={
            dashboard.overdueCount > 0
              ? n(dashboard.overdueCount)
              : dashboard.averageMarkPercentage !== null
                ? formatPercentage(dashboard.averageMarkPercentage, locale)
                : "—"
          }
          icon={dashboard.overdueCount > 0 ? AlertTriangle : TrendingUp}
          tone={dashboard.overdueCount > 0 ? "danger" : "success"}
        />
      </Stagger>

      <FadeInUp delay={0.08} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t.dashboard.dueSoon}</h2>
          <Link
            href="/student/assignments"
            className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
          >
            {t.student.myAssignments}
          </Link>
        </div>

        {dashboard.dueSoon.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t.dashboard.noDueSoon} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {dashboard.dueSoon.map((assignment) => (
              <AssignmentDueRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </FadeInUp>
    </div>
  );
}
