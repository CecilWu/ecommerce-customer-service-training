import Link from "next/link";
import { ArrowLeft, BarChart3, ClipboardList, PackageSearch, PencilLine, Trash2, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScoreReport } from "@/lib/growth";

const typeLabel: Record<string, string> = {
  DAILY: "日常训练",
  ASSESSMENT: "阶段测评",
  EXAM: "出师考核"
};

const difficultyLabel: Record<string, string> = {
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难"
};

function parseObjectives(value: string) {
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(/[;；,\n]/).map((item) => item.trim()).filter(Boolean);
  }
}

export default async function MentorTaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser(["MASTER"]);
  const { taskId } = await params;
  const task = await prisma.task.findFirst({
    where: { id: taskId, createdById: user.id, isArchived: false },
    include: {
      product: true,
      organizationUnit: true,
      enrollments: {
        include: { user: true },
        orderBy: { joinedAt: "asc" }
      },
      sessions: {
        include: {
          user: true,
          report: true
        },
        orderBy: { startedAt: "desc" }
      }
    }
  });

  if (!task) notFound();

  const objectives = parseObjectives(task.objectivesJson);
  const orderInfo = (() => {
    try {
      return JSON.parse(task.orderInfoJson) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  })();
  const reportSessions = task.sessions.filter(
    (session): session is typeof session & { report: NonNullable<typeof session.report> } => Boolean(session.report)
  );
  const reports = reportSessions.map((session) => session.report);
  const averageScore = reports.length ? Math.round(reports.reduce((sum, report) => sum + report.totalScore, 0) / reports.length) : null;
  const completedUserIds = new Set(reportSessions.map((session) => session.userId));
  const highRiskCount = reports.reduce((sum, report) => {
    const parsed = parseScoreReport(report.reportJson);
    return sum + (parsed?.riskItems?.filter((risk) => risk.riskLevel !== "一般风险").length ?? 0);
  }, 0);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">任务管理</span>
          <h1>{task.title}</h1>
          <p>
            {typeLabel[task.type]} · {difficultyLabel[task.difficulty]} · {task.product.name}
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link className="button secondary" href={`/mentor/tasks/${task.id}/edit`}>
            <PencilLine size={17} />
            修改任务
          </Link>
          {!task.sessions.length ? (
            <form action="/api/tasks" method="post">
              <input type="hidden" name="action" value="delete-empty" />
              <input type="hidden" name="taskId" value={task.id} />
              <button className="button secondary danger-action" type="submit">
                <Trash2 size={17} />
                删除任务
              </button>
            </form>
          ) : null}
          <Link className="button secondary" href="/mentor/tasks">
            <ArrowLeft size={17} />
            返回任务列表
          </Link>
        </div>
      </div>

      <div className="grid four">
        <div className="card">
          <p className="muted">加入徒弟</p>
          <strong className="stat-number">{task.enrollments.length}</strong>
          <p className="muted">师父指定范围</p>
        </div>
        <div className="card">
          <p className="muted">已完成</p>
          <strong className="stat-number">{completedUserIds.size}</strong>
          <p className="muted">已形成报告</p>
        </div>
        <div className="card">
          <p className="muted">平均分</p>
          <strong className="stat-number">{averageScore ?? "-"}</strong>
          <p className="muted">按本任务报告计算</p>
        </div>
        <div className="card">
          <p className="muted">高风险</p>
          <strong className="stat-number">{highRiskCount}</strong>
          <p className="muted">严重或重大风险</p>
        </div>
      </div>

      <div className="grid two">
        <section className="admin-section">
          <div className="section-title">
            <ClipboardList size={22} />
            <div>
              <h2>任务情境</h2>
              <p>徒弟训练时看到的任务背景和考核目标。</p>
            </div>
          </div>
          <div className="stack">
            <div className="flat-card">
              <strong>班级/部门</strong>
              <p className="muted" style={{ marginBottom: 0 }}>{task.organizationUnit?.name ?? "未绑定"}</p>
            </div>
            <div className="flat-card">
              <strong>客户情况</strong>
              <p className="muted" style={{ marginBottom: 0 }}>{task.scenario}</p>
            </div>
            <div className="flat-card">
              <strong>订单与客户资料</strong>
              <div className="task-order-detail-grid">
                <span>订单号：{orderInfo.orderNo || "未提供"}</span><span>下单/签收：{orderInfo.placedAt || "未提供"}</span>
                <span>实付/数量：{orderInfo.amount || "-"} · {orderInfo.quantity || "-"}</span><span>规格：{orderInfo.variant || "未提供"}</span>
                <span>物流状态：{orderInfo.logisticsStatus || "未提供"}</span><span>现有凭证：{orderInfo.evidenceStatus || "未提供"}</span>
              </div>
              {task.customerProfile ? <p className="muted" style={{ marginBottom: 0 }}>客户画像：{task.customerProfile}</p> : null}
            </div>
            <div className="flat-card">
              <strong>能力目标</strong>
              <div className="row" style={{ flexWrap: "wrap", marginTop: 12 }}>
                {objectives.map((item) => (
                  <span className="badge blue" key={item}>{item}</span>
                ))}
                {!objectives.length ? <span className="muted">未设置能力目标</span> : null}
              </div>
            </div>
            <div className="flat-card">
              <strong>训练规则</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                {task.timeLimit}分钟 · {task.roundLimit}轮 · {task.type === "EXAM" ? (task.allowMakeupExam ? "允许补考" : "提交后不可补考") : (task.allowRetry ? "允许重复训练" : "提交后不可重复训练")} · 未提交不归档 ·
                {task.reportVisibleMode === "mentor_review" ? " 师父审核后可见" : " 训练后立即可见"}
              </p>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="section-title">
            <PackageSearch size={22} />
            <div>
              <h2>产品资料</h2>
              <p>FAQ只作为知识参考，不直接变成标准答案。</p>
            </div>
          </div>
          <div className="stack">
            <div className="flat-card">
              <span className="badge green">{task.product.category}</span>
              <h3 style={{ margin: "10px 0 8px" }}>{task.product.name}</h3>
              <p className="muted" style={{ margin: 0 }}>{task.product.description}</p>
            </div>
            <div className="flat-card">
              <strong>售后边界</strong>
              <ul className="compact-list">
                {task.product.policyText.split("\n").filter(Boolean).slice(0, 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <UsersRound size={22} />
            <div>
              <h2>加入任务的徒弟</h2>
              <p>只展示被当前师父加入本任务的徒弟和完成情况。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>序号</th>
                <th>徒弟</th>
                <th>班级/部门</th>
                <th>训练次数</th>
                <th>最近得分</th>
                <th>报告</th>
              </tr>
            </thead>
            <tbody>
              {task.enrollments.map((enrollment, index) => {
                const sessions = task.sessions.filter((session) => session.userId === enrollment.userId);
                const latestReport = reportSessions.find((session) => session.userId === enrollment.userId)?.report;
                return (
                  <tr key={enrollment.id}>
                    <td>{index + 1}</td>
                    <td><strong>{enrollment.user.username}</strong></td>
                    <td>{enrollment.user.className ?? "-"}</td>
                    <td>{sessions.length}</td>
                    <td>{latestReport ? `${latestReport.totalScore}分 · ${latestReport.level}` : "未完成"}</td>
                    <td>
                      {latestReport ? (
                        <Link className="button secondary nowrap-button" href={`/mentor/reports/${latestReport.id}`}>查看报告</Link>
                      ) : (
                        <span className="muted">暂无</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!task.enrollments.length ? <p className="muted">该任务还没有加入徒弟。</p> : null}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <BarChart3 size={22} />
            <div>
              <h2>本任务报告</h2>
              <p>按训练开始时间倒序展示最近提交记录。</p>
            </div>
          </div>
          <Link className="button secondary nowrap-button" href="/mentor/reports">全部报告</Link>
        </div>
        <div className="admin-list">
          {reportSessions.slice(0, 6).map((session) => (
            <Link className="admin-list-item" href={`/mentor/reports/${session.report.id}`} key={session.id}>
              <div>
                <strong>{session.user.username}</strong>
                <p className="muted">{session.startedAt.toLocaleString("zh-CN")}</p>
              </div>
              <span className={`badge nowrap-badge ${session.report.totalScore >= 80 ? "green" : session.report.totalScore >= 70 ? "orange" : "red"}`}>
                {session.report.totalScore}分
              </span>
            </Link>
          ))}
          {!reports.length ? <p className="muted">该任务还没有形成报告。</p> : null}
        </div>
      </section>
    </>
  );
}
