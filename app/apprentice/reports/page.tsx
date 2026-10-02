import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScoreReport } from "@/lib/growth";
import { apprenticeVisibleReportWhere } from "@/lib/report-access";

export default async function ApprenticeReportsPage() {
  const user = await requireUser(["APPRENTICE"]);
  const reports = await prisma.scoreReport.findMany({
    where: apprenticeVisibleReportWhere(user.id),
    include: {
      session: {
        include: {
          task: { include: { product: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <section className="container stack">
        <div className="section-title">
          <MessageSquareText size={26} />
          <div>
            <h1 style={{ margin: 0 }}>训练诊断报告</h1>
            <p>每一次提交评分都会形成一份可追踪的实训报告和诊改建议。</p>
          </div>
        </div>

        <section className="card">
          <div className="table-wrap">
            <table className="table apprentice-report-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>任务</th>
                  <th>产品</th>
                  <th>得分</th>
                  <th>等级</th>
                  <th>待补强</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((record, index) => {
                  const report = parseScoreReport(record.reportJson);
                  return (
                    <tr key={record.id}>
                      <td>
                        <strong>{index + 1}</strong>
                      </td>
                      <td className="report-task-cell">
                        <Link className="table-title-link" href={`/apprentice/reports/${record.id}`}>
                          {record.session.task.title}
                        </Link>
                        <div className="muted report-task-summary">
                          {record.session.task.scenario}
                        </div>
                      </td>
                      <td>{record.session.task.product.name}</td>
                      <td>
                        <strong>{record.totalScore}</strong>
                      </td>
                      <td>
                        <span className={`badge nowrap-badge ${record.totalScore >= 80 ? "green" : record.totalScore >= 70 ? "orange" : "red"}`}>
                          {record.level}
                        </span>
                      </td>
                      <td>{report?.skillTags?.weak?.slice(0, 3).join("、") || "-"}</td>
                      <td>{record.createdAt.toLocaleString("zh-CN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!reports.length ? <p className="muted">还没有诊断报告，请先完成一次训练评分。</p> : null}
          </div>
        </section>
      </section>
    </>
  );
}
