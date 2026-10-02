import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";

function cleanLines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MASTER") {
    return NextResponse.json({ error: "无权限添加产品资料" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "请求格式错误，请使用表单提交产品资料" }, { status: 400 });
  }
  const action = String(formData.get("action") || "create").trim();
  const productId = String(formData.get("productId") || "").trim();

  if (action === "delete") {
    const confirmDelete = String(formData.get("confirmDelete") || "").trim();
    if (!productId) return NextResponse.json({ error: "缺少产品资料ID" }, { status: 400 });
    if (confirmDelete !== "删除产品") {
      return NextResponse.json({ error: "请输入“删除产品”确认删除" }, { status: 400 });
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, createdById: user.id },
      include: { _count: { select: { tasks: true } } }
    });
    if (!product) return NextResponse.json({ error: "产品资料不存在" }, { status: 404 });
    if (product._count.tasks > 0) {
      return NextResponse.json({ error: "该产品已关联历史任务，只允许修改，不能删除" }, { status: 409 });
    }
    await prisma.product.delete({ where: { id: product.id } });
    return NextResponse.redirect(requestUrl(request, "/mentor/products?product=deleted"), { status: 303 });
  }

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const faqText = cleanLines(formData.get("faqText"));
  const policyText = cleanLines(formData.get("policyText"));

  if (!name || !category || !description) {
    return NextResponse.json({ error: "产品名称、品类和说明不能为空" }, { status: 400 });
  }

  const content = [description, faqText, policyText].filter(Boolean).join("\n");
  const productData = { name, category, description, faqText, policyText };

  if (action === "update") {
    if (!productId) return NextResponse.json({ error: "缺少产品资料ID" }, { status: 400 });
    const existing = await prisma.product.findFirst({ where: { id: productId, createdById: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "产品资料不存在" }, { status: 404 });
    const product = await prisma.product.update({ where: { id: existing.id }, data: productData });
    const faqUpdate = await prisma.faqDocument.updateMany({
      where: { productId: product.id, sourceType: "product" },
      data: { title: `${name}产品资料`, content }
    });
    if (!faqUpdate.count && content) {
      await prisma.faqDocument.create({
        data: {
          title: `${name}产品资料`,
          sourceType: "product",
          content,
          productId: product.id,
          uploadedById: user.id
        }
      });
    }
    return NextResponse.redirect(requestUrl(request, `/mentor/products/${product.id}/edit?product=updated`), { status: 303 });
  }

  if (action !== "create") return NextResponse.json({ error: "未知产品操作" }, { status: 400 });
  const product = await prisma.product.create({ data: { ...productData, createdById: user.id } });
  if (content) {
    await prisma.faqDocument.create({
      data: {
        title: `${name}产品资料`,
        sourceType: "product",
        content,
        productId: product.id,
        uploadedById: user.id
      }
    });
  }
  return NextResponse.redirect(requestUrl(request, "/mentor/products?product=created"), { status: 303 });
}
