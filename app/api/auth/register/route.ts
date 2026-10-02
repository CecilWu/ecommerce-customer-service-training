import { NextResponse } from "next/server";
import { createSessionToken, hashPassword, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncApprenticeTaskEnrollments } from "@/lib/task-enrollments";
import { normalizeAndValidateUsername } from "@/lib/username";

const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
    confirmPassword?: string;
    organizationUnitId?: string;
  } | null;

  const { username, error: usernameError } = normalizeAndValidateUsername(body?.username);
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");
  const organizationUnitId = String(body?.organizationUnitId ?? "").trim();

  if (usernameError) return NextResponse.json({ error: usernameError }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `密码至少需要${MIN_PASSWORD_LENGTH}位` }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "两次输入的密码不一致" }, { status: 400 });
  }
  if (!organizationUnitId) {
    return NextResponse.json({ error: "请选择所属班级" }, { status: 400 });
  }

  const unit = await prisma.organizationUnit.findFirst({
    where: {
      id: organizationUnitId,
      isActive: true,
      ownerId: { not: null }
    }
  });
  if (!unit) {
    return NextResponse.json({ error: "所选班级/部门不存在、已停用或尚未分配师父" }, { status: 400 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username,
          passwordHash: hashPassword(password),
          role: "APPRENTICE",
          className: unit.name,
          organizationUnitId: unit.id,
          isActive: true
        },
        select: {
          id: true,
          username: true,
          role: true,
          className: true,
          organizationUnitId: true,
          signatureImagePath: true
        }
      });
      await syncApprenticeTaskEnrollments(tx, createdUser.id, unit.id);
      return createdUser;
    });

    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set({
      ...sessionCookieOptions(),
      value: createSessionToken(user)
    });
    return response;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "该用户名已被注册，请换一个用户名" }, { status: 409 });
    }
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
