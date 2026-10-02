import Link from "next/link";
import { ArrowLeft, ClipboardCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScoreReport } from "@/lib/growth";
import { messageFromDb } from "@/lib/mappers";
import { reportNeedsMentorReview } from "@/lib/report-access";

type MentorReview = {
  mentorReview?: {
    mentorUsername?: string;
    // 兼容用户体系升级前已保存的历史报告。
    mentorName?: string;
    reviewedAt?: string;
    originalScore?: number;
    finalScore?: number;
    comment?: string;
  };
};

export default async function MentorReportDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ reviewed?: string }>;
}) {
  const user = await requireUser(["MASTER"]);
  const { reportId } = await params;
  const { reviewed } = await searchParams;
  const record = await prisma.scoreReport.findFirst({
    where: {
      id: reportId,
      session: { task: { createdById: user.id } }
    },
    include: {
      reviewedBy: true,
      session: {
        include: {
          user: true,
          task: { include: { product: true } },
          messages: { orderBy: { createdAt: "asc" } }
        }
      }
    }
  });

  if (!record) notFound();
  const report = parseScoreReport(record.reportJson);
  if (!report) notFound();
  const mentorReview = (JSON.parse(record.reportJson) as MentorReview).mentorReview;
  const messages = record.session.messages.map(messageFromDb);
  const needsReview = reportNeedsMentorReview(record);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">报告审核</span>
          <h1>{record.session.user.username}的诊断报告</h1>
          <p>
            {record.session.task.title} · {record.session.task.product.name} · {record.createdAt.toLocaleString("zh-CN")}
          </p>
        </div>
        <Link className="button secondary" href="/mentor/reports">
          <ArrowLeft size={17} />
          返回审核队列
        </Link>
      </div>

      {reviewed ? (
        <section className="admin-section">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <ShieldCheck size={22} />
            <div>
              <h2>审核已保存</h2>
              <p>分数、审核意见和报告可见状态已经更新。</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <ClipboardCheck size={22} />
            <div>
              <h2>师父复核</h2>
              <p>{needsReview ? "该报告当前等待师父审核，审核后徒弟才能查看。" : "可对报告分数与诊断意见进行复核留痕。"}</p>
            </div>
          </div>
        </div>
        <form className="stack" action={`/api/mentor/reports/${record.id}`} method="post">
          <div className="form-grid">
            <label className="field">
              <span>复核分数</span>
              <input className="input" type="number" min={0} max={100} name="finalScore" defaultValue={record.totalScore} />
            </label>
            <label className="field">
              <span>审核状态</span>
              <input className="input" value={record.reviewedAt ? `已由${record.reviewedBy?.username ?? "师父"}复核` : "待复核"} readOnly />
            </label>
          </div>
          <label className="field">
            <span>师父审核意见</span>
            <textarea
              className="textarea"
              name="mentorComment"
              defaultValue={mentorReview?.comment ?? ""}
              maxLength={500}
              placeholder="例如：本次能先安抚再核实，但退换货时效和闭环确认还需要加强。"
            />
            <small className="field-hint">建议写清“肯定点、风险点、下一次训练动作”，便于徒弟诊改。</small>
          </label>
          <button className="button primary nowrap-button" type="submit">
            <ShieldCheck size={17} />
            保存审核结果
          </button>
        </form>
      </section>

      <ReportView report={report} />

      <section className="admin-section">
        <div className="section-title">
          <MessageSquareText size={22} />
          <div>
            <h2>对话证据链</h2>
            <p>师父可对照学生原话、客户反应和风险提醒进行人工复核。</p>
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
