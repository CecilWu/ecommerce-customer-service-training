"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  FileText,
  Gauge,
  KeyRound,
  Target,
  Trophy
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavGroup = {
  title: string;
  items: Array<{ label: string; href: string; icon: LucideIcon; exact?: boolean }>;
};

const navGroups: NavGroup[] = [
  {
    title: "训练台首页",
    items: [{ label: "运行概览", href: "/apprentice", icon: Gauge, exact: true }]
  },
  {
    title: "实训中心",
    items: [{ label: "我的任务", href: "/apprentice/tasks", icon: Target }]
  },
  {
    title: "诊断成长",
    items: [
      { label: "诊断报告", href: "/apprentice/reports", icon: FileText },
      { label: "成长画像", href: "/apprentice/growth", icon: BarChart3 }
    ]
  },
  {
    title: "出师认证",
    items: [
      { label: "出师考核", href: "/apprentice/exam/final", icon: Trophy },
      { label: "出师证书", href: "/apprentice/certificate", icon: Award }
    ]
  },
  {
    title: "个人设置",
    items: [{ label: "修改密码", href: "/apprentice/password", icon: KeyRound }]
  }
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ApprenticeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar apprentice-sidebar">
      <div className="admin-sidebar-head">
        <span className="badge orange">徒弟导航</span>
        <h2>徒弟训练台</h2>
      </div>
      <nav className="admin-nav" aria-label="徒弟训练台导航">
        {navGroups.map((group) => (
          <div className="admin-nav-group" key={group.title}>
            <div className="admin-nav-title">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link
                  className={`admin-nav-link ${active ? "active" : ""}`}
                  href={item.href}
                  key={`${group.title}-${item.label}`}
                >
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
