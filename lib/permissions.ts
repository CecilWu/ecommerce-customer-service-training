import type { AuthUser } from "./auth";

export function isAdmin(user: AuthUser | null | undefined) {
  return user?.role === "ADMIN";
}

export function isSuperAdmin(user: AuthUser | null | undefined) {
  return user?.role === "ADMIN" && user.username === "admin";
}

export function isMaster(user: AuthUser | null | undefined) {
  return user?.role === "MASTER";
}

export function isApprentice(user: AuthUser | null | undefined) {
  return user?.role === "APPRENTICE";
}

export function canManageTask(user: AuthUser, task: { createdById: string | null }) {
  return user.role === "MASTER" && task.createdById === user.id;
}

export function roleLabel(role: string) {
  if (role === "ADMIN") return "管理员";
  if (role === "MASTER") return "师父";
  return "徒弟";
}
