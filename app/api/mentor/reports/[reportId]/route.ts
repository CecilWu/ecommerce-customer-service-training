import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScoreReport } from "@/lib/growth";
import { requestUrl } from "@/lib/http";
import { clampScore, passStatusFromScore } from "@/lib/report-access";
import { scoreLevel } from "@/lib/scoring";
import { syncCertificateForExamAttempt } from "@/lib/certificates";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MASTER") {
    return NextResponse.json({ error: "只有师父可以审核自己任务下的报告" }, { status: 403 });
  }

  const { reportId } = await params;
  const formData = await request.formData();
  const mentorComment = String(formData.get("mentorComment") || "").trim();
  const requestedScore = clampScore(Number(formData.get("finalScore")));

  const record = await prisma.scoreReport.findFirst({
    where: {
      id: reportId,
      session: { task: { createdById: user.id } }
    },
    include: {
      session: {
        include: {
          user: true,
          task: true
        }
      }
    }
  });

  if (!record) {
    return NextResponse.json({ error: "报告不存在，或不属于当前师父管理范围" }, { status: 404 });
  }

  const parsedReport = parseScoreReport(record.reportJson);
  if (!parsedReport) {
    return NextResponse.json({ error: "报告数据无法解析" }, { status: 422 });
  }

  const finalScore = requestedScore ?? record.totalScore;
  const finalLevel = scoreLevel(finalScore);
  const reviewedAt = new Date();
  const nextReportJson = {
    ...parsedReport,
    totalScore: finalScore,
    level: finalLevel,
    passStatus: passStatusFromScore(finalScore),
    mentorReview: {
      mentorId: user.id,
      mentorUsername: user.username,
      reviewedAt: reviewedAt.toISOString(),
      originalScore: record.totalScore,
      finalScore,
      comment: mentorComment || "师父已复核本次训练报告。"
    }
  };

  await prisma.$transaction(async (tx) => {
    await tx.scoreReport.update({
      where: { id: record.id },
      data: {
        totalScore: finalScore,
        level: finalLevel,
        passStatus: passStatusFromScore(finalScore),
        reportJson: JSON.stringify(nextReportJson),
        reviewedById: user.id,
        reviewedAt
      }
    });

    await tx.trainingSession.update({
      where: { id: record.sessionId },
      data: { status: "REVIEWED" }
    });

    if (record.session.task.type === "EXAM") {
      await syncCertificateForExamAttempt(tx, {
        userId: record.session.userId,
        finalScore,
        level: finalLevel,
        issuedAt: reviewedAt
      });
    }
  });

  return NextResponse.redirect(requestUrl(request, `/mentor/reports/${record.id}?reviewed=1`), { status: 303 });
}
