import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { prisma } from "@/lib/db";

export default async function AdminOverviewPage() {
  const [users, taskCount, reportCount, aiProviderCount] = await Promise.all([
    prisma.user.findMany({ select: { role: true } }),
    prisma.task.count(),
    prisma.scoreReport.count(),
    prisma.aiProvider.count()
  ]);

  const masterCount = users.filter((user) => user.role === "MASTER").length;
  const apprenticeCount = users.filter((user) => user.role === "APPRENTICE").length;

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">系统后台</span>
          <h1>运营概览</h1>
          <p>查看系统关键数据，后续可扩展班级统计、训练趋势和模型调用成本。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <LayoutDashboard size={22} />
            <div>
              <h2>总览指标</h2>
              <p>管理员负责系统配置、账号权限和平台数据监管，不进入师父工作台执行业务任务。</p>
            </div>
          </div>
        </div>
        <div className="grid four">
          <Link className="stat-link" href="/admin/accounts">
            <StatCard label="师父数量" value={`${masterCount}`} detail="不含管理员" />
          </Link>
          <Link className="stat-link" href="/admin/accounts">
            <StatCard label="徒弟数量" value={`${apprenticeCount}`} detail="学生账号" />
          </Link>
          <Link className="stat-link" href="/admin/tasks">
            <StatCard label="任务总数" value={`${taskCount}`} detail="全部师父创建" />
          </Link>
          <Link className="stat-link" href="/admin/reports">
            <StatCard label="报告总数" value={`${reportCount}`} detail="训练评价记录" />
          </Link>
        </div>
        <div className="grid two" style={{ marginTop: 18 }}>
          <Link className="stat-link" href="/admin/ai">
            <StatCard label="AI模型配置" value={`${aiProviderCount}`} detail="后台可启用或删除" />
          </Link>
          <Link className="stat-link" href="/admin/permissions">
            <StatCard label="权限模式" value="三角色" detail="管理员、师父、徒弟" />
          </Link>
        </div>
      </section>
    </>
  );
}
