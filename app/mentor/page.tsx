import Link from "next/link";
import { BarChart3, ClipboardList, GraduationCap, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const typeLabel = {
  DAILY: "日常训练",
  ASSESSMENT: "阶段测评",
  EXAM: "出师考核"
};

export default async function MentorPage() {
  const user = await requireUser(["MASTER"]);
  const reportWhere = { session: { task: { createdById: user.id } } };

  const [tasks, reports, riskReports, activeApprentices] = await Promise.all([
    prisma.task.findMany({
      where: { createdById: user.id, isArchived: false },
      include: { product: true, enrollments: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.scoreReport.findMany({
      where: reportWhere,
      include: { session: { include: { user: true, task: true } } },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.scoreReport.count({
      where: {
        AND: [
          reportWhere,
          {
            OR: [{ reportJson: { contains: "严重风险" } }, { reportJson: { contains: "重大风险" } }, { reportJson: { contains: "过度承诺" } }]
          }
        ]
      }
    }),
    prisma.taskEnrollment.findMany({
      where: { task: { createdById: user.id, isArchived: false } },
      distinct: ["userId"],
      select: { userId: true }
    })
  ]);

  const averageScore = reports.length ? (reports.reduce((sum, report) => sum + report.totalScore, 0) / reports.length).toFixed(1) : "暂无";

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">师父工作台</span>
          <h1>运行概览</h1>
          <p>查看自己带教任务的整体运行情况，具体功能请从左侧菜单进入。</p>
        </div>
      </div>

      <div className="grid four">
        <Link className="stat-link" href="/mentor/tasks">
          <StatCard label="已发布任务" value={`${tasks.length}`} detail="最近任务池" />
        </Link>
        <Link className="stat-link" href="/mentor/tasks">
          <StatCard label="参与徒弟" value={`${activeApprentices.length}`} detail="已加入你的任务" />
        </Link>
        <Link className="stat-link" href="/mentor/reports">
          <StatCard label="平均得分" value={averageScore} detail="最近5份报告" />
        </Link>
        <Link className="stat-link" href="/mentor/reports">
          <StatCard label="高风险话术" value={`${riskReports}次`} detail="过度承诺、推责、绕平台" />
        </Link>
      </div>

      <div className="grid two">
        <section className="admin-section">
          <div className="admin-section-head">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <ClipboardList size={22} />
              <div>
                <h2>最近任务</h2>
                <p>展示最近发布的训练、测评和出师考核。</p>
              </div>
            </div>
            <Link className="button secondary nowrap-button" href="/mentor/tasks">
              任务列表
            </Link>
          </div>
          <div className="admin-list">
            {tasks.map((task) => (
              <Link className="admin-list-item" href={`/mentor/tasks/${task.id}`} key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p className="muted">{task.product.name} · {typeLabel[task.type]} · {task.enrollments.length}人加入</p>
                </div>
                <span className="badge blue nowrap-badge">{task.timeLimit}分钟</span>
              </Link>
            ))}
            {!tasks.length ? <p className="muted">还没有发布任务。</p> : null}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <BarChart3 size={22} />
              <div>
                <h2>最近诊断</h2>
                <p>展示最近生成的徒弟训练报告。</p>
              </div>
            </div>
            <Link className="button secondary nowrap-button" href="/mentor/reports">
              报告审核
            </Link>
          </div>
          <div className="admin-list">
            {reports.map((report) => (
              <Link className="admin-list-item" href={`/mentor/reports/${report.id}`} key={report.id}>
                <div>
                  <strong>{report.session.user.username}</strong>
                  <p className="muted">{report.session.task.title} · {report.level}</p>
                </div>
                <span className={`badge nowrap-badge ${report.totalScore >= 80 ? "green" : report.totalScore >= 60 ? "orange" : "red"}`}>
                  {report.totalScore}分
                </span>
              </Link>
            ))}
            {!reports.length ? <p className="muted">还没有训练报告。</p> : null}
          </div>
        </section>
      </div>

      <div className="grid three">
        <section className="admin-section">
          <div className="section-title">
            <GraduationCap size={22} />
            <div>
              <h2>带教进度</h2>
              <p>后续可扩展班级进度、未完成提醒和出师达标率。</p>
            </div>
          </div>
        </section>
        <section className="admin-section">
          <div className="section-title">
            <MessageSquareWarning size={22} />
            <div>
              <h2>客户压力库</h2>
              <p>简单、中等、困难三档客户强度由任务难度控制。</p>
            </div>
          </div>
        </section>
        <section className="admin-section">
          <div className="section-title">
            <ShieldAlert size={22} />
            <div>
              <h2>质检风险</h2>
              <p>重点观察过度承诺、诱导删评、绕平台沟通和推责表达。</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
