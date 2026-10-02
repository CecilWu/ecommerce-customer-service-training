import Link from "next/link";
import { BriefcaseBusiness, GraduationCap, Home, LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel as formatRoleLabel } from "@/lib/permissions";

export async function AppHeader({
  roleLabel,
  actions,
  hideWorkspaceLink = false
}: {
  roleLabel?: string;
  actions?: React.ReactNode;
  hideWorkspaceLink?: boolean;
}) {
  const user = await getCurrentUser();

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">
          <GraduationCap size={22} />
        </span>
        <span>
          <span className="brand-title">电商客服AI岗位实训平台</span>
          <span className="brand-subtitle">极端客户训练 · 企业质检评分 · 出师认证</span>
        </span>
      </Link>
      <nav className="nav-actions">
        {user ? (
          <span className="identity-chip" aria-label="当前登录账号">
            <UserRound size={17} />
            {user.username} · {formatRoleLabel(user.role)}
          </span>
        ) : roleLabel ? (
          <span className="badge blue">{roleLabel}</span>
        ) : null}
        {actions}
        {user?.role === "ADMIN" && !hideWorkspaceLink ? (
          <Link className="button secondary" href="/admin">
            <Settings size={17} />
            管理后台
          </Link>
        ) : null}
        {user?.role === "MASTER" && !hideWorkspaceLink ? (
          <Link className="button secondary" href="/mentor">
            <BriefcaseBusiness size={17} />
            师父工作台
          </Link>
        ) : null}
        {user?.role === "APPRENTICE" && !hideWorkspaceLink ? (
          <Link className="button secondary" href="/apprentice">
            <BriefcaseBusiness size={17} />
            徒弟训练台
          </Link>
        ) : null}
        <Link className="button secondary" href="/">
          <Home size={17} />
          首页
        </Link>
        {user ? (
          <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
            <button className="button secondary" type="submit">
              <LogOut size={17} />
              退出
            </button>
          </form>
        ) : (
          <Link className="button primary" href="/login">
            <LogIn size={17} />
            登录
          </Link>
        )}
      </nav>
    </header>
  );
}
