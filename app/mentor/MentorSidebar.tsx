"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, BookOpenText, Building2, ClipboardList, FilePlus2, Gauge, KeyRound, PackageSearch, Stamp, Trophy, UploadCloud } from "lucide-react";

const navGroups = [
  {
    title: "工作台首页",
    items: [{ label: "运行概览", href: "/mentor", icon: Gauge, exact: true }]
  },
  {
    title: "任务管理",
    items: [
      { label: "任务列表", href: "/mentor/tasks", icon: ClipboardList, exact: true },
      { label: "发布任务", href: "/mentor/tasks/new", icon: FilePlus2 }
    ]
  },
  {
    title: "带教组织",
    items: [{ label: "班级/部门", href: "/mentor/org-units", icon: Building2 }]
  },
  {
    title: "知识与报告",
    items: [
      { label: "产品资料", href: "/mentor/products", icon: PackageSearch },
      { label: "企业FAQ", href: "/mentor/faq", icon: UploadCloud },
      { label: "报告审核", href: "/mentor/reports", icon: BarChart3 }
    ]
  },
  {
    title: "出师认证",
    items: [
      { label: "出师考核", href: "/mentor/exams", icon: Trophy },
      { label: "证书管理", href: "/mentor/certificates", icon: Award }
    ]
  },
  {
    title: "个人设置",
    items: [
      { label: "修改密码", href: "/mentor/password", icon: KeyRound },
      { label: "师父签章", href: "/mentor/signature", icon: Stamp }
    ]
  },
  {
    title: "教研沉淀",
    items: [{ label: "评价体系", href: "/docs", icon: BookOpenText }]
  }
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MentorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-head">
        <span className="badge blue">师父导航</span>
        <h2>师父工作台</h2>
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
