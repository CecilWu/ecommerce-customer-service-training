import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { normalizeUsername } from "@/lib/username";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = normalizeUsername(body?.username);
  const password = body?.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "用户名或密码不正确" }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      className: user.className
    }
  });

  response.cookies.set({
    ...sessionCookieOptions(),
    value: createSessionToken(user)
  });

  return response;
}
