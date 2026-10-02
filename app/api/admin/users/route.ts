import { NextResponse } from "next/server";
import { hashPassword, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSuperAdmin } from "@/lib/permissions";
import { syncApprenticeTaskEnrollments } from "@/lib/task-enrollments";
import { normalizeAndValidateUsername, normalizeUsername } from "@/lib/username";
import { requestUrl } from "@/lib/http";

const DEFAULT_RESET_PASSWORD = "wuxiaobo";
const validRoles = ["ADMIN", "MASTER", "APPRENTICE"] as const;
type EditableRole = (typeof validRoles)[number];

function parseImportRows(raw: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === "\t" || char === "，") && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  if (rows[0]?.[0]?.replace(/^\uFEFF/, "").includes("用户名")) rows.shift();
  else if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}

async function activeOrganizationUnit(id: string) {
  if (!id) return null;
  return prisma.organizationUnit.findFirst({ where: { id, isActive: true, ownerId: { not: null } } });
}

function canManageTarget(currentUser: Awaited<ReturnType<typeof requireUser>>, target: { role: string }) {
  return target.role !== "ADMIN" || isSuperAdmin(currentUser);
}

function redirectTo(path: string, request: Request) {
  return NextResponse.redirect(requestUrl(request, path), { status: 303 });
}

export async function POST(request: Request) {
  const currentUser = await requireUser(["ADMIN"]);
  const formData = await request.formData();
  const action = String(formData.get("action") || "create");

  if (action === "delete" || action === "reset" || action === "update") {
    const username = normalizeUsername(formData.get("username"));
    if (!username) return NextResponse.json({ error: "缺少账号" }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    if (!canManageTarget(currentUser, target)) {
      return NextResponse.json({ error: "只有超级管理员可以管理管理员账号" }, { status: 403 });
    }

    if (action === "delete") {
      if (target.id === currentUser.id) return NextResponse.json({ error: "不能删除当前登录账号" }, { status: 400 });
      if (target.username === "admin") return NextResponse.json({ error: "不能删除超级管理员账号" }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: target.id }, data: { isActive: false } });
        if (target.role === "APPRENTICE") {
          await syncApprenticeTaskEnrollments(tx, target.id, target.organizationUnitId, false);
        }
      });
      return redirectTo("/admin/accounts?user=deleted", request);
    }

    if (action === "reset") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: target.id },
          data: { passwordHash: hashPassword(DEFAULT_RESET_PASSWORD), isActive: true }
        });
        if (target.role === "APPRENTICE") {
          await syncApprenticeTaskEnrollments(tx, target.id, target.organizationUnitId, true);
        }
      });
      return redirectTo("/admin/accounts?user=reset", request);
    }

    const submittedRole = String(formData.get("role") || target.role).trim();
    if (submittedRole !== target.role) {
      return NextResponse.json({ error: "账号创建后角色不可修改；如需变更，请删除后重新创建" }, { status: 400 });
    }
    const password = String(formData.get("password") || "");
    const organizationUnitId = String(formData.get("organizationUnitId") || "").trim();
    const data: { passwordHash?: string; isActive: boolean; className: string | null; organizationUnitId: string | null } = {
      isActive: true,
      className: null,
      organizationUnitId: null
    };
    if (password) data.passwordHash = hashPassword(password);

    if (target.role === "APPRENTICE") {
      const unit = await activeOrganizationUnit(organizationUnitId);
      if (!unit) return NextResponse.json({ error: "请选择有效的班级/部门" }, { status: 400 });
      data.className = unit.name;
      data.organizationUnitId = unit.id;
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data });
      if (target.role === "APPRENTICE") {
        await syncApprenticeTaskEnrollments(tx, target.id, data.organizationUnitId, data.isActive);
      }
    });
    return redirectTo("/admin/accounts?user=updated", request);
  }

  if (action === "bulk-reset" || action === "bulk-delete") {
    const usernames = formData.getAll("usernames").map(normalizeUsername).filter(Boolean);
    if (!usernames.length) return NextResponse.json({ error: "请先勾选账号" }, { status: 400 });
    const targets = await prisma.user.findMany({ where: { username: { in: usernames } } });
    const allowed = targets.filter((target) => target.username !== currentUser.username && target.username !== "admin" && canManageTarget(currentUser, target));
    if (!allowed.length) return NextResponse.json({ error: "没有可操作的账号" }, { status: 400 });

    if (action === "bulk-reset") {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.updateMany({
          where: { id: { in: allowed.map((target) => target.id) } },
          data: { passwordHash: hashPassword(DEFAULT_RESET_PASSWORD), isActive: true }
        });
        for (const target of allowed) {
          if (target.role === "APPRENTICE") {
            await syncApprenticeTaskEnrollments(tx, target.id, target.organizationUnitId, true);
          }
        }
        return updated;
      });
      return redirectTo(`/admin/accounts?user=bulk-reset&count=${result.count}`, request);
    }

    if (String(formData.get("deleteConfirm") || "").trim() !== "吴晓波") {
      return NextResponse.json({ error: "批量删除需要输入“吴晓波”确认" }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: { in: allowed.map((target) => target.id) } },
        data: { isActive: false }
      });
      for (const target of allowed) {
        if (target.role === "APPRENTICE") {
          await syncApprenticeTaskEnrollments(tx, target.id, target.organizationUnitId, false);
        }
      }
      return updated;
    });
    return redirectTo(`/admin/accounts?user=bulk-delete&count=${result.count}`, request);
  }

  if (action === "import") {
    const csvFile = formData.get("csvFile");
    const fileText = csvFile && typeof csvFile !== "string" && csvFile.size > 0 ? await csvFile.text() : "";
    const rows = parseImportRows(fileText || String(formData.get("rows") || ""));
    if (!rows.length) return NextResponse.json({ error: "请上传CSV文件或粘贴CSV内容" }, { status: 400 });

    const units = await prisma.organizationUnit.findMany({ where: { isActive: true, ownerId: { not: null } } });
    const unitByName = new Map(units.map((unit) => [unit.name, unit]));
    let created = 0;
    let skipped = 0;

    for (const [usernameRaw, passwordRaw, unitRaw] of rows) {
      const { username, error: usernameError } = normalizeAndValidateUsername(usernameRaw);
      const unit = unitByName.get(unitRaw?.trim() || "");
      if (usernameError || !unit) {
        skipped += 1;
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              username,
              passwordHash: hashPassword(passwordRaw || DEFAULT_RESET_PASSWORD),
              role: "APPRENTICE",
              className: unit.name,
              organizationUnitId: unit.id,
              isActive: true
            }
          });
          await syncApprenticeTaskEnrollments(tx, user.id, unit.id);
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    }
    return redirectTo(`/admin/accounts/new?imported=${created}&skipped=${skipped}`, request);
  }

  const { username, error: usernameError } = normalizeAndValidateUsername(formData.get("username"));
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "APPRENTICE") as EditableRole;
  const organizationUnitId = String(formData.get("organizationUnitId") || "").trim();

  if (usernameError) return NextResponse.json({ error: usernameError }, { status: 400 });
  if (!password) return NextResponse.json({ error: "密码不能为空" }, { status: 400 });
  if (!validRoles.includes(role)) return NextResponse.json({ error: "角色无效" }, { status: 400 });
  if (role === "ADMIN" && !isSuperAdmin(currentUser)) {
    return NextResponse.json({ error: "只有超级管理员可以创建管理员账号" }, { status: 403 });
  }

  const data: {
    username: string;
    passwordHash: string;
    role: EditableRole;
    className: string | null;
    organizationUnitId: string | null;
  } = { username, passwordHash: hashPassword(password), role, className: null, organizationUnitId: null };
  if (role === "APPRENTICE") {
    const unit = await activeOrganizationUnit(organizationUnitId);
    if (!unit) return NextResponse.json({ error: "徒弟账号必须选择有效的班级/部门" }, { status: 400 });
    data.className = unit.name;
    data.organizationUnitId = unit.id;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      if (role === "APPRENTICE") {
        await syncApprenticeTaskEnrollments(tx, user.id, data.organizationUnitId);
      }
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2002") return NextResponse.json({ error: "用户名已存在，请换一个用户名" }, { status: 409 });
    return NextResponse.json({ error: "创建账号失败" }, { status: 500 });
  }
  return redirectTo("/admin/accounts?user=created", request);
}
