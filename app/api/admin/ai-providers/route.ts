import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptApiKey } from "@/lib/ai/settings";
import { requestUrl } from "@/lib/http";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(requestUrl(request, path), 303);
}

export async function POST(request: Request) {
  await requireUser(["ADMIN"]);
  const formData = await request.formData();
  const action = String(formData.get("action") || "save");
  const id = String(formData.get("id") || "").trim();

  if (action === "activate") {
    if (!id) return NextResponse.json({ error: "缺少模型配置ID" }, { status: 400 });
    await prisma.$transaction([
      prisma.aiProvider.updateMany({ data: { isActive: false } }),
      prisma.aiProvider.update({ where: { id }, data: { isActive: true } })
    ]);
    return redirectTo(request, "/admin/ai?ai=activated");
  }

  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "缺少模型配置ID" }, { status: 400 });
    const target = await prisma.aiProvider.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "模型配置不存在" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.aiProvider.delete({ where: { id } });

      if (target.isActive) {
        const nextProvider = await tx.aiProvider.findFirst({ orderBy: { updatedAt: "desc" } });
        if (nextProvider) {
          await tx.aiProvider.update({
            where: { id: nextProvider.id },
            data: { isActive: true }
          });
        }
      }
    });

    return redirectTo(request, "/admin/ai?ai=deleted");
  }

  const name = String(formData.get("name") || "").trim();
  const provider = String(formData.get("provider") || "deepseek").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim().replace(/\/$/, "");
  const model = String(formData.get("model") || "").trim();
  const apiKey = String(formData.get("apiKey") || "").trim();
  const isActive = String(formData.get("isActive") || "") === "on";

  if (!name || !provider || !baseUrl || !model) {
    return NextResponse.json({ error: "名称、供应商、接口地址和模型名不能为空" }, { status: 400 });
  }
  if (!id && !apiKey) {
    return NextResponse.json({ error: "新增模型时必须填写API Key" }, { status: 400 });
  }
  try {
    const parsedBaseUrl = new URL(baseUrl);
    if (!(["http:", "https:"] as string[]).includes(parsedBaseUrl.protocol)) throw new Error("invalid protocol");
  } catch {
    return NextResponse.json({ error: "API接口地址必须是有效的HTTP或HTTPS地址" }, { status: 400 });
  }

  const data = {
    name,
    provider,
    baseUrl,
    model,
    ...(apiKey ? { apiKeyEncrypted: encryptApiKey(apiKey) } : {})
  };

  await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.aiProvider.updateMany({ data: { isActive: false } });
    }

    if (id) {
      const existing = await tx.aiProvider.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new Error("模型配置不存在");
      await tx.aiProvider.update({
        where: { id },
        data: {
          ...data,
          isActive
        }
      });
    } else {
      await tx.aiProvider.create({
        data: {
          ...data,
          isActive
        }
      });
    }
  });

  return redirectTo(request, "/admin/ai?ai=saved");
}
