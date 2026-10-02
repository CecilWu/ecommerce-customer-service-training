import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { generateInitialCustomerReply } from "@/lib/ai/client";
import { createInitialCustomerState } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { messageFromDb, productFromDb, taskFromDb } from "@/lib/mappers";
import { searchKnowledge } from "@/lib/rag/search";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "APPRENTICE") {
    return NextResponse.json({ error: "只有徒弟可以进入训练会话" }, { status: 403 });
  }

  const body = (await request.json()) as { taskId?: string };
  const taskRecord = await prisma.task.findFirst({
    where: { id: body.taskId ?? "sample", isArchived: false },
    include: { product: true }
  });
  if (!taskRecord) return NextResponse.json({ error: "任务不存在或已被师父删除" }, { status: 404 });

  let enrollment = await prisma.taskEnrollment.findUnique({
    where: {
      taskId_userId: {
        taskId: taskRecord.id,
        userId: user.id
      }
    }
  });
  if (!enrollment && user.organizationUnitId && taskRecord.organizationUnitId === user.organizationUnitId) {
    enrollment = await prisma.taskEnrollment.create({
      data: { taskId: taskRecord.id, userId: user.id, assignedById: taskRecord.createdById }
    });
  }
  if (!enrollment) return NextResponse.json({ error: "该任务不属于你所在的班级/部门" }, { status: 403 });

  const isFormalExam = taskRecord.type === "EXAM";
  if ((isFormalExam && !taskRecord.allowMakeupExam) || (!isFormalExam && !taskRecord.allowRetry)) {
    const submittedAttempt = await prisma.scoreReport.findFirst({
      where: { session: { taskId: taskRecord.id, userId: user.id } },
      select: { id: true }
    });
    if (submittedAttempt) {
      return NextResponse.json({ error: isFormalExam ? "该正式出师考核未开放补考，已提交过评分" : "该任务不允许重复训练，已提交过评分" }, { status: 409 });
    }
  }

  const task = taskFromDb(taskRecord);
  const product = productFromDb(taskRecord.product);
  // 客户合作倾向按任务难度小概率抽取，并写入会话状态，保证同一会话内人格稳定。
  const state = createInitialCustomerState(task.difficulty, randomInt(100));
  const knowledge = await searchKnowledge({
    productId: product.id,
    query: `${task.title}\n${task.scenario}\n${product.description}`,
    limit: 6
  });
  const initialReply = await generateInitialCustomerReply({ task, product, state, knowledge });

  const session = await prisma.$transaction(async (tx) => {
    // 未评分会话只是临时上下文。确认 AI 已生成开场白后，再原子地清理旧会话并创建新会话。
    await tx.trainingSession.deleteMany({
      where: {
        userId: user.id,
        taskId: taskRecord.id,
        status: "RUNNING",
        report: { is: null }
      }
    });

    return tx.trainingSession.create({
      data: {
        taskId: taskRecord.id,
        userId: user.id,
        currentStateJson: JSON.stringify(initialReply.state),
        messages: {
          create: {
            role: "CUSTOMER",
            content: initialReply.message
          }
        }
      },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });
  });

  return NextResponse.json({
    sessionId: session.id,
    state: initialReply.state,
    messages: session.messages.map(messageFromDb),
    ai: initialReply.meta
  });
}
