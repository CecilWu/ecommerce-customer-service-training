import Link from "next/link";
import { ArrowRight, FilePlus2, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MentorExamsPage() {
  const user = await requireUser(["MASTER"]);
  const exams = await prisma.task.findMany({
    where: { createdById: user.id, type: "EXAM", isArchived: false },
    include: {
      product: true,
      enrollments: true,
      sessions: { include: { report: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const totalReports = exams.reduce((sum, exam) => sum + exam.sessions.filter((session) => session.report).length, 0);
  const passedReports = exams.reduce(
    (sum, exam) => sum + exam.sessions.filter((session) => (session.report?.totalScore ?? 0) >= 80).length,
    0
  );

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">出师认证</span>
          <h1>出师考核</h1>
          <p>集中管理正式上岗考试任务，查看参考人数、提交情况和通过结果。</p>
        </div>
        <Link className="button primary" href="/mentor/tasks/new">
          <FilePlus2 size={17} />
          发布考核任务
        </Link>
      </div>

      <div className="grid three">
        <div className="card">
          <p className="muted">考核任务</p>
          <strong className="stat-number">{exams.length}</strong>
          <p className="muted">正式出师考核</p>
        </div>
        <div className="card">
          <p className="muted">已提交报告</p>
          <strong className="stat-number">{totalReports}</strong>
          <p className="muted">等待或完成审核</p>
        </div>
        <div className="card">
          <p className="muted">达标通过</p>
          <strong className="stat-number">{passedReports}</strong>
          <p className="muted">80分及以上</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Trophy size={22} />
            <div>
              <h2>考核任务列表</h2>
              <p>建议期末出师考核采用困难难度，并设置为“师父审核后可见”。</p>
            </div>
          </div>
        </div>
        <div className="grid two">
          {exams.map((exam) => {
            const submitted = exam.sessions.filter((session) => session.report).length;
            const passed = exam.sessions.filter((session) => (session.report?.totalScore ?? 0) >= 80).length;
            return (
              <article className="flat-card stack" key={exam.id}>
                <div className="spread">
                  <div>
                    <span className="badge red">出师考核</span>
                    <h3 style={{ margin: "10px 0 6px" }}>{exam.title}</h3>
                    <p className="muted" style={{ margin: 0 }}>{exam.product.name} · {exam.timeLimit}分钟 · {exam.roundLimit}轮</p>
                  </div>
                  <Trophy size={26} />
                </div>
                <p className="muted" style={{ margin: 0 }}>{exam.scenario}</p>
                <div className="grid three">
                  <div className="flat-card">
                    <strong>{exam.enrollments.length}</strong>
                    <p className="muted" style={{ margin: 0 }}>参考徒弟</p>
                  </div>
                  <div className="flat-card">
                    <strong>{submitted}</strong>
                    <p className="muted" style={{ margin: 0 }}>已提交</p>
                  </div>
                  <div className="flat-card">
                    <strong>{passed}</strong>
                    <p className="muted" style={{ margin: 0 }}>已达标</p>
                  </div>
                </div>
                <Link className="button secondary nowrap-button" href={`/mentor/tasks/${exam.id}`}>
                  查看考核详情
                  <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
        {!exams.length ? <p className="muted">当前还没有出师考核任务，可从“发布任务”创建类型为出师考核的任务。</p> : null}
      </section>
    </>
  );
}
