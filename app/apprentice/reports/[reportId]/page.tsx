import { MessageSquareText } from "lucide-react";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { messageFromDb } from "@/lib/mappers";
import { parseScoreReport } from "@/lib/growth";
import { reportNeedsMentorReview } from "@/lib/report-access";

export default async function ApprenticeReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const user = await requireUser(["APPRENTICE"]);
  const { reportId } = await params;
  const record = await prisma.scoreReport.findFirst({
    where: {
      id: reportId,
      session: { userId: user.id }
    },
    include: {
      session: {
        include: {
          task: { include: { product: true } },
          messages: { orderBy: { createdAt: "asc" } }
        }
      }
    }
  });

  if (!record) notFound();
  if (reportNeedsMentorReview(record)) notFound();
  const report = parseScoreReport(record.reportJson);
  if (!report) notFound();
  const messages = record.session.messages.map(messageFromDb);

  return (
    <>
      <section className="container stack">
        <section className="card">
          <div className="section-title">
            <MessageSquareText size={26} />
            <div>
              <h1 style={{ margin: 0 }}>{record.session.task.title}</h1>
              <p>
                {record.session.task.product.name} · {record.createdAt.toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
        </section>

        <ReportView report={report} />

        <section className="card">
          <div className="section-title">
            <MessageSquareText size={22} />
            <div>
              <h2>本次对话证据</h2>
              <p>对照诊断报告，回看客户反应和自己的关键回复。</p>
            </div>
          </div>
          <div className="report-transcript">
            {messages.map((message) => (
              <div className={`message ${message.role === "customer" ? "customer" : "apprentice"}`} key={message.id}>
                <strong>{message.role === "customer" ? "客户" : "徒弟"}</strong>
                <p style={{ margin: "6px 0 0" }}>{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
