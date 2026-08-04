"use client";

import Link from "next/link";
import {
  ClipboardList,
  Inbox,
  Layers,
  Plus,
  Send,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { SubmissionStatusBadge, LateBadge } from "@/components/common/status-badge";
import { Stagger, FadeInUp } from "@/components/motion/primitives";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative } from "@/lib/format";
import type {
  AssignmentDto,
  OfferingOption,
  PagedResult,
  SubmissionSummary,
} from "@/lib/api/types";

export function TeacherDashboardView({
  assignments,
  awaitingReview,
  offerings,
  name,
}: {
  assignments: AssignmentDto[];
  awaitingReview: PagedResult<SubmissionSummary>;
  offerings: OfferingOption[];
  name: string;
}) {
  const { t, tx, locale, n } = useTranslation();

  const firstName = name.split(" ")[0] ?? name;
  const published = assignments.filter((a) => a.status === "Published");
  const drafts = assignments.filter((a) => a.status === "Draft");
  const students = offerings.reduce((sum, o) => sum + o.enrolledStudentCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx(t.dashboard.welcome, { name: firstName })}
        description={t.dashboard.overview}
        actions={
          <Button render={<Link href="/teacher/assignments/new" />}>
            <Plus className="size-4" aria-hidden />
            {t.assignments.newAssignment}
          </Button>
        }
      />

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t.dashboard.pendingReview}
          value={n(awaitingReview.totalCount)}
          icon={Inbox}
          tone={awaitingReview.totalCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t.dashboard.activeAssignments}
          value={n(published.length)}
          hint={drafts.length > 0 ? `${n(drafts.length)} ${t.assignments.statusDraft}` : undefined}
          icon={ClipboardList}
        />
        <StatCard label={t.nav.offerings} value={n(offerings.length)} icon={Layers} />
        <StatCard label={t.classes.students} value={n(students)} icon={Users} />
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-5">
        <FadeInUp delay={0.08} className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.dashboard.pendingReview}</h2>
            <Link
              href="/teacher/grading"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              {t.nav.grading}
            </Link>
          </div>

          {awaitingReview.items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t.grading.empty}
              description={t.dashboard.noDueSoon}
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {awaitingReview.items.map((submission) => (
                <Link
                  key={submission.id}
                  href={`/teacher/grading/${submission.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">{submission.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {submission.assignmentTitle}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {submission.isLate ? <LateBadge /> : null}
                    <span className="text-xs text-muted-foreground tabular">
                      {formatRelative(submission.submittedAt, locale)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </FadeInUp>

        <FadeInUp delay={0.12} className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t.nav.offerings}</h2>

          {offerings.length === 0 ? (
            <EmptyState icon={Layers} title={t.offerings.empty} />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {offerings.map((offering) => (
                <Link
                  key={offering.classSubjectId}
                  href={`/teacher/assignments?classSubjectId=${offering.classSubjectId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{offering.subjectName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {offering.className}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {n(offering.enrolledStudentCount)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </FadeInUp>
      </div>
    </div>
  );
}
