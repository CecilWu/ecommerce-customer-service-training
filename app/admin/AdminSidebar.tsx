"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  Building2,
  KeyRound,
  LockKeyhole,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  UserPlus,
  UsersRound
} from "lucide-react";

const navGroups = [
  {
    title: "系统总览",
    items: [
      { label: "运营概览", href: "/admin", icon: LayoutDashboard, exact: true },
      { label: "任务总览", href: "/admin/tasks", icon: ListChecks, exact: true },
      { label: "报告总览", href: "/admin/reports", icon: MessageSquareText, exact: true }
    ]
  },
  {
    title: "账号权限",
    items: [
      { label: "班级/部门", href: "/admin/org-units", icon: Building2 },
      { label: "添加账号", href: "/admin/accounts/new", icon: UserPlus },
      { label: "账号列表", href: "/admin/accounts", icon: UsersRound, exact: true },
      { label: "权限边界", href: "/admin/permissions", icon: ShieldCheck }
    ]
  },
  {
    title: "AI模型",
    items: [
      { label: "新增模型", href: "/admin/ai/new", icon: BrainCircuit },
      { label: "模型列表", href: "/admin/ai", icon: KeyRound, exact: true }
    ]
  },
  {
    title: "个人安全",
    items: [{ label: "修改密码", href: "/admin/password", icon: LockKeyhole }]
  }
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-head">
        <h2>系统设置</h2>
      </div>
      <nav className="admin-nav">
        {navGroups.map((group) => (
          <div className="admin-nav-group" key={group.title}>
            <div className="admin-nav-title">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link className={`admin-nav-link ${active ? "active" : ""}`} href={item.href} key={`${group.title}-${item.label}`}>
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
