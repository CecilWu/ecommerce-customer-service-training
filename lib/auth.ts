import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "./db";

const COOKIE_NAME = "ecs_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const DEVELOPMENT_SESSION_SECRET = "local-development-session-secret-change-on-vps";

export type AuthUser = Pick<User, "id" | "username" | "role" | "className" | "organizationUnitId" | "signatureImagePath">;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || DEVELOPMENT_SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (secret === DEVELOPMENT_SESSION_SECRET || secret.length < 32)) {
    throw new Error("生产环境必须配置至少32个字符的SESSION_SECRET");
  }
  return secret;
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(hash, "hex");
  const expected = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(user: AuthUser) {
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(sign(payload), "base64url");
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub: string;
      exp: number;
      role: string;
      username: string;
    };
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  noStore();
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, role: true, className: true, organizationUnitId: true, signatureImagePath: true, isActive: true }
  });

  if (!user?.isActive) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    className: user.className,
    organizationUnitId: user.organizationUnitId,
    signatureImagePath: user.signatureImagePath
  };
}

export function sessionCookieOptions() {
  const secureSetting = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  const secure = secureSetting === "false" || secureSetting === "0" || secureSetting === "no"
    ? false
    : secureSetting === "true" || secureSetting === "1" || secureSetting === "yes"
      ? true
      : process.env.NODE_ENV === "production";

  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}

export function roleHome(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "MASTER") return "/mentor";
  return "/apprentice";
}

export async function requireUser(roles?: string[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles?.length && !roles.includes(user.role)) {
    redirect(roleHome(user.role));
  }
  return user;
}
