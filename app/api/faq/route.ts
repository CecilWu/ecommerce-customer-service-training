import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "MASTER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限查看FAQ知识库" }, { status: 403 });
  }

  const docs = await prisma.faqDocument.findMany({
    where: user.role === "MASTER" ? {
      OR: [
        { uploadedById: user.id },
        { product: { createdById: null } },
        { product: { createdById: user.id } }
      ]
    } : undefined,
    include: { product: true, uploadedBy: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return NextResponse.json({ docs });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MASTER") {
    return NextResponse.json({ error: "无权限上传FAQ" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") || "企业FAQ资料").trim();
  const productId = String(formData.get("productId") || "").trim() || null;
  const textContent = String(formData.get("content") || "").trim();
  const file = formData.get("file");

  let fileText = "";
  let sourceType = "text";
  if (file instanceof File && file.size > 0) {
    sourceType = file.name.split(".").pop() || "file";
    fileText = (await file.text()).trim();
  }

  const content = fileText || textContent;
  if (!content) {
    return NextResponse.json({ error: "FAQ内容不能为空" }, { status: 400 });
  }

  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, OR: [{ createdById: null }, { createdById: user.id }] },
      select: { id: true }
    });
    if (!product) return NextResponse.json({ error: "无权关联该产品资料" }, { status: 403 });
  }

  await prisma.faqDocument.create({
    data: {
      title,
      sourceType,
      content,
      productId,
      uploadedById: user.id
    }
  });

  return NextResponse.redirect(requestUrl(request, "/mentor/faq?faq=uploaded"), { status: 303 });
}
