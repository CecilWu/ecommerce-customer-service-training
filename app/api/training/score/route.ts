import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateScoreReport } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { messageFromDb, productFromDb, taskFromDb } from "@/lib/mappers";
import { searchKnowledge } from "@/lib/rag/search";
import { syncCertificateForExamAttempt } from "@/lib/certificates";

class SessionAlreadySubmittedError extends Error {}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "APPRENTICE") {
    return NextResponse.json({ error: "只有徒弟可以提交训练评分" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: "训练会话不能为空" }, { status: 400 });

  const session = await prisma.trainingSession.findFirst({
    where: { id: body.sessionId, userId: user.id },
    include: {
      task: { include: { product: true } },
      messages: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!session) return NextResponse.json({ error: "训练会话不存在" }, { status: 404 });
  if (session.task.isArchived) {
    return NextResponse.json({ error: "该任务已被师父删除，当前训练不能提交评分" }, { status: 410 });
  }
  if (session.status !== "RUNNING") {
    return NextResponse.json({ error: "该训练已经提交评分，不能重复评分" }, { status: 409 });
  }

  const messages = session.messages.map(messageFromDb);
  if (!messages.some((message) => message.role === "apprentice")) {
    return NextResponse.json({ error: "请至少完成一轮客服回复后再提交评分" }, { status: 400 });
  }
  const task = taskFromDb(session.task);
  const product = productFromDb(session.task.product);
  const knowledge = await searchKnowledge({
    productId: product.id,
    query: messages.map((message) => message.content).join("\n"),
    limit: 8
  });
  const report = await generateScoreReport({ messages, task, product, knowledge });

  const needsMentorReview = session.task.reportVisibleMode === "mentor_review";
  let scoreRecord;
  try {
    scoreRecord = await prisma.$transaction(async (tx) => {
      const claimed = await tx.trainingSession.updateMany({
        where: { id: session.id, userId: user.id, status: "RUNNING" },
        data: { status: "SUBMITTED", endedAt: new Date() }
      });
      if (claimed.count !== 1) throw new SessionAlreadySubmittedError();

      const created = await tx.scoreReport.create({
        data: {
          sessionId: session.id,
          totalScore: report.totalScore,
          rawScore: report.rawScore,
          level: report.level,
          passStatus: report.passStatus,
          summary: report.summary,
          reportJson: JSON.stringify(report)
        }
      });

      if (session.task.type === "EXAM" && !needsMentorReview) {
        await syncCertificateForExamAttempt(tx, {
          userId: user.id,
          finalScore: report.totalScore,
          level: report.level,
          issuedAt: new Date()
        });
      }
      return created;
    });
  } catch (error) {
    if (error instanceof SessionAlreadySubmittedError) {
      return NextResponse.json({ error: "该训练已经提交评分，不能重复评分" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({
    report,
    reportId: scoreRecord.id,
    sessionId: session.id
  });
}
