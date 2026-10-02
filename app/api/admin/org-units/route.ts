import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";

function redirectTo(path: string, request: Request) {
  return NextResponse.redirect(requestUrl(request, path), { status: 303 });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !["ADMIN", "MASTER"].includes(currentUser.role)) {
    return NextResponse.json({ error: "无权限管理班级/部门" }, { status: 403 });
  }

  const formData = await request.formData();
  const action = String(formData.get("action") || "create").trim();
  const id = String(formData.get("id") || "").trim();
  const returnPath = currentUser.role === "MASTER" ? "/mentor/org-units" : "/admin/org-units";

  if (action === "create") {
    if (currentUser.role !== "MASTER") {
      return NextResponse.json({ error: "班级/部门需由师父创建" }, { status: 403 });
    }

    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!name) return NextResponse.json({ error: "班级/部门名称不能为空" }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: "班级/部门名称不能超过60个字符" }, { status: 400 });

    try {
      await prisma.organizationUnit.create({
        data: {
          name,
          description,
          // 历史类型字段保留兼容旧数据；业务上统一使用“班级/部门”。
          type: "CLASS",
          ownerId: currentUser.id,
          isActive: true
        }
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "P2002") {
        return NextResponse.json({ error: "班级/部门名称已存在，请换一个名称" }, { status: 409 });
      }
      return NextResponse.json({ error: "创建班级/部门失败" }, { status: 500 });
    }

    return redirectTo(`${returnPath}?org=created`, request);
  }

  if (!id) return NextResponse.json({ error: "缺少班级/部门ID" }, { status: 400 });
  const unit = await prisma.organizationUnit.findUnique({ where: { id } });
  if (!unit) return NextResponse.json({ error: "班级/部门不存在" }, { status: 404 });

  if (action === "reassign") {
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "只有管理员可以调整带教师父" }, { status: 403 });
    }
    const ownerId = String(formData.get("ownerId") || "").trim();
    const owner = await prisma.user.findFirst({
      where: { id: ownerId, role: "MASTER", isActive: true },
      select: { id: true }
    });
    if (!owner) return NextResponse.json({ error: "请选择启用状态的师父" }, { status: 400 });

    await prisma.organizationUnit.update({ where: { id }, data: { ownerId: owner.id } });
    return redirectTo("/admin/org-units?org=reassigned", request);
  }

  if (action === "update") {
    if (currentUser.role !== "MASTER" || unit.ownerId !== currentUser.id) {
      return NextResponse.json({ error: "只能维护自己创建的班级/部门" }, { status: 403 });
    }
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!name) return NextResponse.json({ error: "班级/部门名称不能为空" }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: "班级/部门名称不能超过60个字符" }, { status: 400 });

    try {
      await prisma.$transaction([
        prisma.organizationUnit.update({ where: { id }, data: { name, description } }),
        prisma.user.updateMany({
          where: { role: "APPRENTICE", organizationUnitId: id },
          data: { className: name }
        })
      ]);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "P2002") return NextResponse.json({ error: "班级/部门名称已存在，请换一个名称" }, { status: 409 });
      return NextResponse.json({ error: "保存班级/部门失败" }, { status: 500 });
    }
    return redirectTo("/mentor/org-units?org=updated", request);
  }

  if (action === "delete") {
    if (currentUser.role === "MASTER" && unit.ownerId !== currentUser.id) {
      return NextResponse.json({ error: "只能删除自己创建的班级/部门" }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: {
          role: "APPRENTICE",
          OR: [{ organizationUnitId: unit.id }, { className: unit.name }]
        },
        data: { organizationUnitId: null, className: null }
      }),
      prisma.organizationUnit.delete({ where: { id: unit.id } })
    ]);
    return redirectTo(`${returnPath}?org=deleted`, request);
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
