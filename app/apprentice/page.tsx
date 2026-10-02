import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpenCheck, ClipboardList, GraduationCap, MessageSquareText, Trophy } from "lucide-react";
import { GrowthRadar } from "@/components/GrowthRadar";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aggregateRadarDimensions } from "@/lib/growth";
import { apprenticeVisibleReportWhere } from "@/lib/report-access";

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

export default async function ApprenticePage() {
  const user = await requireUser(["APPRENTICE"]);
  const [nextTasks, reports, sessions] = await Promise.all([
    prisma.task.findMany({ where: { isArchived: false, enrollments: { some: { userId: user.id } } }, orderBy: { createdAt: "desc" }, take: 3 }),
    prisma.scoreReport.findMany({
      where: apprenticeVisibleReportWhere(user.id),
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.trainingSession.count({ where: { userId: user.id } })
  ]);
  const latest = reports[0];
  const radar = aggregateRadarDimensions(reports);

  return (
    <>
      <section className="container stack">
        <div className="section-title">
          <GraduationCap size={26} />
          <div>
            <h1 style={{ margin: 0 }}>徒弟训练台</h1>
            <p>完成师父发布的训练任务，在AI极端客户接待中积累证据、获得诊断、准备出师。</p>
          </div>
        </div>

        <div className="grid three">
          <Link href="/apprentice/reports">
            <StatCard label="累计训练" value={`${sessions}次`} detail={user.className ?? "徒弟账号"} />
          </Link>
          <Link href={latest ? `/apprentice/reports/${latest.id}` : "/apprentice/reports"}>
            <StatCard label="最近得分" value={latest ? `${latest.totalScore}` : "暂无"} detail={latest?.level ?? "完成训练后生成"} />
          </Link>
          <Link href="/apprentice/reports">
            <StatCard label="报告数量" value={`${reports.length}`} detail="已保存诊断报告" />
          </Link>
        </div>

        <div className="grid two">
          <section className="card">
            <div className="section-title">
              <ClipboardList size={22} />
              <div>
                <h2>今日任务</h2>
                <p>从课堂训练到正式考核，按岗位成长路径逐步推进。</p>
              </div>
            </div>
            <div className="stack">
              {nextTasks.map((task) => (
                <div className="flat-card" key={task.id}>
                  <div className="spread">
                    <div>
                      <strong>{task.title}</strong>
                      <div className="task-tag-row">
                        <span className={`task-chip task-type-${task.type.toLowerCase()}`}>{typeLabel[task.type] ?? task.type}</span>
                        <span className={`task-chip task-difficulty-${task.difficulty.toLowerCase()}`}>
                          {difficultyLabel[task.difficulty] ?? task.difficulty}
                        </span>
                      </div>
                      <p className="muted" style={{ margin: "6px 0 0" }}>
                        {task.scenario}
                      </p>
                    </div>
                    <Link className="button primary nowrap-button task-start-button" href={`/apprentice/training/${task.id}`}>
                      开始
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </div>
              ))}
              {!nextTasks.length ? <p className="muted">当前还没有分配任务。</p> : null}
            </div>
            <Link className="button secondary" href="/apprentice/tasks" style={{ marginTop: 16 }}>
              查看全部任务
            </Link>
          </section>

          <section className="card">
            <div className="section-title">
              <BookOpenCheck size={22} />
              <div>
                <h2>成长画像</h2>
                <p>系统把每次对话转化为可追踪的客服能力证据。</p>
              </div>
            </div>
            <GrowthRadar dimensions={radar} compact />
            <div className="grid two" style={{ marginTop: 16 }}>
              <Link className="button secondary" href="/apprentice/reports">
                <MessageSquareText size={17} />
                诊断报告
              </Link>
              <Link className="button secondary" href="/apprentice/growth">
                <Trophy size={17} />
                成长画像
              </Link>
            </div>
          </section>
        </div>

        <section className="card">
          <div className="spread">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <BadgeCheck size={22} />
              <div>
                <h2>出师认证进度</h2>
                <p>完成基础训练、阶段测评和期末出师考核后生成证书。</p>
              </div>
            </div>
            <Link className="button primary nowrap-button" href="/apprentice/certificate">
              查看证书
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
