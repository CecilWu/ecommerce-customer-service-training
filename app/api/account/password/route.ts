import { NextResponse } from "next/server";
import { hashPassword, requireUser, roleHome, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";

function defaultPasswordPath(role: string) {
  if (role === "ADMIN") return "/admin/password";
  if (role === "MASTER") return "/mentor/password";
  return "/apprentice/password";
}

function safeReturnTo(role: string, raw: string) {
  const fallback = defaultPasswordPath(role);
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw === fallback) return raw;

  const home = roleHome(role);
  return raw.startsWith(`${home}/`) ? raw : fallback;
}

function redirectWithStatus(request: Request, path: string, status: string) {
  const url = requestUrl(request, path);
  url.searchParams.set("password", status);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const returnTo = safeReturnTo(user.role, String(formData.get("returnTo") || ""));
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return redirectWithStatus(request, returnTo, "missing");
  }
  if (newPassword !== confirmPassword) {
    return redirectWithStatus(request, returnTo, "mismatch");
  }
  if (newPassword.length < 6) {
    return redirectWithStatus(request, returnTo, "weak");
  }
  if (newPassword === currentPassword) {
    return redirectWithStatus(request, returnTo, "same");
  }

  const record = await prisma.user.findFirst({
    where: { id: user.id, isActive: true },
    select: { id: true, passwordHash: true }
  });
  if (!record) return redirectWithStatus(request, returnTo, "invalid");

  const oldPasswordValid = verifyPassword(currentPassword, record.passwordHash);
  if (!oldPasswordValid) return redirectWithStatus(request, returnTo, "old");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) }
  });

  return redirectWithStatus(request, returnTo, "updated");
}
