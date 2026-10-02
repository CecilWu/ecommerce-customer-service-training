import Link from "next/link";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScoreReport } from "@/lib/growth";
import { messageFromDb } from "@/lib/mappers";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  await requireUser(["ADMIN"]);
  const { reportId } = await params;
  const record = await prisma.scoreReport.findUnique({
    where: { id: reportId },
    include: {
      reviewedBy: true,
      session: {
        include: {
          user: true,
          task: { include: { product: true, createdBy: true } },
          messages: { orderBy: { createdAt: "asc" } }
        }
      }
    }
  });

  if (!record) notFound();
  const report = parseScoreReport(record.reportJson);
  if (!report) notFound();
  const messages = record.session.messages.map(messageFromDb);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">系统总览</span>
          <h1>报告详情</h1>
          <p>
            {record.session.user.username} · {record.session.task.title} · 师父 {record.session.task.createdBy?.username ?? "未绑定"}
          </p>
        </div>
        <Link className="button secondary" href="/admin/reports">
          <ArrowLeft size={17} />
          返回报告总览
        </Link>
      </div>

      <section className="admin-section">
        <div className="grid three">
          <div className="flat-card">
            <span className="stat-label">学生</span>
            <strong>{record.session.user.username}</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>{record.session.user.className ?? record.session.user.username}</p>
          </div>
          <div className="flat-card">
            <span className="stat-label">任务产品</span>
            <strong>{record.session.task.product.name}</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>{record.session.task.product.category}</p>
          </div>
          <div className="flat-card">
            <span className="stat-label">审核状态</span>
            <strong>{record.reviewedAt ? "已复核" : "未复核"}</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>{record.reviewedBy?.username ?? "暂无师父复核"}</p>
          </div>
        </div>
      </section>

      <ReportView report={report} />

      <section className="admin-section">
        <div className="section-title">
          <MessageSquareText size={22} />
          <div>
            <h2>对话记录</h2>
            <p>管理员只读查看训练证据，用于平台监管和教研抽查。</p>
          </div>
        </div>
        <div className="report-transcript">
          {messages.map((message) => (
            <div className={`message ${message.role === "customer" ? "customer" : message.role === "apprentice" ? "apprentice" : "system"}`} key={message.id}>
              <strong>{message.role === "customer" ? "客户" : message.role === "apprentice" ? "徒弟" : "系统"}</strong>
              <p style={{ margin: "6px 0 0" }}>{message.content}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
