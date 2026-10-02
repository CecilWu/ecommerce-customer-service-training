import type { Prisma, ScoreReport as DbScoreReport, Task } from "@prisma/client";

export function reportNeedsMentorReview(record: Pick<DbScoreReport, "reviewedAt"> & { session: { task: Pick<Task, "reportVisibleMode"> } }) {
  return record.session.task.reportVisibleMode === "mentor_review" && !record.reviewedAt;
}

export function apprenticeVisibleReportWhere(userId: string): Prisma.ScoreReportWhereInput {
  return {
    session: { userId },
    OR: [{ session: { task: { reportVisibleMode: { not: "mentor_review" } } } }, { reviewedAt: { not: null } }]
  };
}

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function passStatusFromScore(score: number) {
  return score >= 70 ? "通过" : "未通过";
}
