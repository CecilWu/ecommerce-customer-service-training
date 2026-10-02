import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateCustomerReply } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { messageFromDb, productFromDb, taskFromDb } from "@/lib/mappers";
import { searchKnowledge } from "@/lib/rag/search";
import type { CustomerState } from "@/lib/types";
import { analyzeTurnQuality } from "@/lib/service-quality";
import { evaluateConversationProgress } from "@/lib/scoring";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "APPRENTICE") {
    return NextResponse.json({ error: "只有徒弟可以提交训练回复" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string; content?: string };
  const content = body.content?.trim();
  if (!body.sessionId || !content) {
    return NextResponse.json({ error: "会话和回复内容不能为空" }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: "单次回复不能超过1000字" }, { status: 400 });
  }

  const session = await prisma.trainingSession.findFirst({
    where: { id: body.sessionId, userId: user.id },
    include: {
      task: { include: { product: true } },
      messages: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!session) return NextResponse.json({ error: "训练会话不存在" }, { status: 404 });
  if (session.task.isArchived) {
    return NextResponse.json({ error: "该任务已被师父删除，当前训练已停止" }, { status: 410 });
  }
  if (session.status !== "RUNNING") return NextResponse.json({ error: "该训练已提交评分" }, { status: 409 });

  const task = taskFromDb(session.task);
  const product = productFromDb(session.task.product);
  const pendingApprenticeMessage = {
    id: `pending-${Date.now()}`,
    role: "apprentice" as const,
    content,
    createdAt: new Date().toISOString()
  };
  const messages = [...session.messages.map(messageFromDb), pendingApprenticeMessage];
  const previousApprenticeReplies = session.messages
    .filter((message) => message.role === "APPRENTICE")
    .map((message) => message.content);
  const turnQuality = analyzeTurnQuality(content, previousApprenticeReplies);
  const state = JSON.parse(session.currentStateJson) as CustomerState;
  const knowledge = await searchKnowledge({
    productId: product.id,
    query: `${session.task.scenario}\n${content}`,
    limit: 5
  });

  const result = await generateCustomerReply({ task, product, messages, state, knowledge });
  let apprenticeMessage;
  let customerMessage;
  try {
    [apprenticeMessage, customerMessage] = await prisma.$transaction(async (tx) => {
      // updatedAt 是轻量级乐观锁，避免双击发送导致同一轮状态被覆盖。
      const claimed = await tx.trainingSession.updateMany({
        where: {
          id: session.id,
          userId: user.id,
          status: "RUNNING",
          updatedAt: session.updatedAt
        },
        data: { currentStateJson: JSON.stringify(result.state) }
      });
      if (claimed.count !== 1) throw new Error("SESSION_CHANGED");

      const savedApprentice = await tx.chatMessage.create({
        data: { sessionId: session.id, role: "APPRENTICE", content }
      });
      const savedCustomer = await tx.chatMessage.create({
        data: { sessionId: session.id, role: "CUSTOMER", content: result.message }
      });
      return [savedApprentice, savedCustomer] as const;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_CHANGED") {
      return NextResponse.json({ error: "会话内容已更新，请刷新后继续" }, { status: 409 });
    }
    throw error;
  }

  const savedMessages = [messageFromDb(apprenticeMessage), messageFromDb(customerMessage)];
  const progress = evaluateConversationProgress([
    ...session.messages.map(messageFromDb),
    ...savedMessages
  ]);

  return NextResponse.json({
    state: result.state,
    messages: savedMessages,
    knowledge,
    ai: result.meta,
    quality: turnQuality,
    progress
  });
}
