import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateTaskAssistDraft } from "@/lib/ai/client";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MASTER") {
    return NextResponse.json({ error: "无权限使用任务AI辅助" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    scenario?: string;
    objectives?: string;
    productName?: string;
    productDescription?: string;
    difficulty?: string;
    type?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "请求内容无效" }, { status: 400 });
  }

  try {
    const draft = await generateTaskAssistDraft({
      scenario: String(body.scenario || ""),
      objectives: String(body.objectives || ""),
      productName: String(body.productName || "未选择产品"),
      productDescription: String(body.productDescription || ""),
      difficulty: String(body.difficulty || "medium"),
      type: String(body.type || "daily")
    });
    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI辅助生成失败，请稍后重试" },
      { status: 502 }
    );
  }
}
