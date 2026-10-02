import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, MessageSquareText, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScoreReport } from "@/lib/growth";
import { reportNeedsMentorReview } from "@/lib/report-access";

const typeLabel: Record<string, string> = {
  DAILY: "日常训练",
  ASSESSMENT: "阶段测评",
  EXAM: "出师考核"
};

export default async function MentorReportsPage() {
  const user = await requireUser(["MASTER"]);
  const reports = await prisma.scoreReport.findMany({
    where: { session: { task: { createdById: user.id } } },
    include: {
      reviewedBy: true,
      session: {
        include: {
          user: true,
          task: { include: { product: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const pendingCount = reports.filter(reportNeedsMentorReview).length;
  const reviewedCount = reports.filter((report) => report.reviewedAt).length;
  const averageScore = reports.length ? Math.round(reports.reduce((sum, item) => sum + item.totalScore, 0) / reports.length) : 0;
  const riskCount = reports.reduce((sum, item) => {
    const parsed = parseScoreReport(item.reportJson);
    return sum + (parsed?.riskItems?.filter((risk) => risk.riskLevel !== "一般风险").length ?? 0);
  }, 0);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">知识与报告</span>
          <h1>报告审核</h1>
          <p>只审核自己发布任务下的徒弟报告，正式考核报告经师父复核后再对徒弟可见。</p>
        </div>
      </div>

      <div className="grid four">
        <div className="card">
          <p className="muted">报告数量</p>
          <strong className="stat-number">{reports.length}</strong>
          <p className="muted">训练与考核记录</p>
        </div>
        <div className="card">
          <p className="muted">待审核</p>
          <strong className="stat-number">{pendingCount}</strong>
          <p className="muted">审核后徒弟可见</p>
        </div>
        <div className="card">
          <p className="muted">已复核</p>
          <strong className="stat-number">{reviewedCount}</strong>
          <p className="muted">师父确认记录</p>
        </div>
        <div className="card">
          <p className="muted">平均分</p>
          <strong className="stat-number">{reports.length ? averageScore : "-"}</strong>
          <p className="muted">高风险 {riskCount} 项</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <ClipboardCheck size={22} />
            <div>
              <h2>审核队列</h2>
              <p>按照生成时间倒序展示，优先处理出师考核与高压投诉报告。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>序号</th>
                <th>徒弟</th>
                <th>任务</th>
                <th>类型</th>
                <th>得分</th>
                <th>风险</th>
                <th>审核状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((record, index) => {
                const parsed = parseScoreReport(record.reportJson);
                const riskItems = parsed?.riskItems?.filter((risk) => risk.riskLevel !== "一般风险") ?? [];
                const needsReview = reportNeedsMentorReview(record);
                return (
                  <tr key={record.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{record.session.user.username}</strong>
                      <div className="muted">{record.session.user.className ?? record.session.user.username}</div>
                    </td>
                    <td>
                      <strong>{record.session.task.title}</strong>
                      <div className="muted">{record.session.task.product.name}</div>
                    </td>
                    <td>{typeLabel[record.session.task.type] ?? record.session.task.type}</td>
                    <td>
                      <strong>{record.totalScore}分</strong>
                      <div className="muted">{record.level}</div>
                    </td>
                    <td>
                      {riskItems.length ? (
                        <span className="badge red">
                          <ShieldAlert size={14} />
                          {riskItems.length}项
                        </span>
                      ) : (
                        <span className="badge green">
                          <CheckCircle2 size={14} />
                          正常
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${needsReview ? "orange" : record.reviewedAt ? "green" : "blue"}`}>
                        {needsReview ? "待师父审核" : record.reviewedAt ? "已复核" : "已生成"}
                      </span>
                    </td>
                    <td>
                      <Link className="button secondary nowrap-button" href={`/mentor/reports/${record.id}`}>
                        审核详情
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!reports.length ? <p className="muted">当前还没有徒弟提交训练报告。</p> : null}
        </div>
      </section>

      <section className="admin-section">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <MessageSquareText size={22} />
          <div>
            <h2>审核原则</h2>
            <p>师父复核重点看证据链是否充分、风险封顶是否合理、诊改建议是否能指导下一次实训。</p>
          </div>
        </div>
      </section>
    </>
  );
}
