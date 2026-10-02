import Link from "next/link";
import { FileText, MessageSquareText } from "lucide-react";
import { prisma } from "@/lib/db";

export default async function AdminReportsPage() {
  const reports = await prisma.scoreReport.findMany({
    include: {
      session: {
        include: {
          user: true,
          task: { include: { product: true, createdBy: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">系统总览</span>
          <h1>报告总览</h1>
          <p>管理员查看全平台训练评价记录，用于监管训练质量和数据沉淀。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <MessageSquareText size={22} />
            <div>
              <h2>全部诊断报告</h2>
              <p>按生成时间倒序展示学生、任务、产品、师父、得分和等级。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>序号</th>
                <th>学生</th>
                <th>任务</th>
                <th>产品</th>
                <th>师父</th>
                <th>得分</th>
                <th>等级</th>
                <th>时间</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, index) => (
                <tr key={report.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{report.session.user.username}</strong>
                    <div className="muted">{report.session.user.className ?? report.session.user.username}</div>
                  </td>
                  <td>{report.session.task.title}</td>
                  <td>{report.session.task.product.name}</td>
                  <td>{report.session.task.createdBy?.username ?? "未绑定"}</td>
                  <td><strong>{report.totalScore}</strong></td>
                  <td><span className={`badge nowrap-badge ${report.totalScore >= 80 ? "green" : report.totalScore >= 70 ? "orange" : "red"}`}>{report.level}</span></td>
                  <td>{report.createdAt.toLocaleString("zh-CN")}</td>
                  <td>
                    <Link className="button secondary nowrap-button" href={`/admin/reports/${report.id}`}>
                      <FileText size={16} />
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reports.length ? <p className="muted">当前还没有训练报告。</p> : null}
        </div>
      </section>
    </>
  );
}
