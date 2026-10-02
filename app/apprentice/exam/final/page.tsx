import Link from "next/link";
import { BadgeCheck, LockKeyhole, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const stages = [
  { title: "第一关：标准接待", detail: "识别诉求、安抚情绪、核实订单与凭证。" },
  { title: "第二关：售后方案", detail: "依据产品规则提出可执行方案，说明时效与跟进。" },
  { title: "第三关：高压投诉", detail: "面对差评威胁与额外赔偿诉求，守住合规边界。" }
];

export default async function FinalExamPage() {
  const user = await requireUser(["APPRENTICE"]);
  const [examReports, finalTask] = await Promise.all([
    prisma.scoreReport.findMany({
      where: { session: { userId: user.id, task: { type: "EXAM" } } },
      include: { session: { include: { task: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.task.findFirst({ where: { id: "final", type: "EXAM", isArchived: false }, select: { allowMakeupExam: true } })
  ]);
  const latest = examReports[0];
  const mayEnterExam = !examReports.length || finalTask?.allowMakeupExam !== false;

  return (
    <>
      <section className="container stack">
        <section className="card">
          <div className="spread">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Trophy size={28} />
              <div>
                <h1 style={{ margin: 0 }}>期末出师考核</h1>
                <p>模拟企业正式上岗考试，结果作为出师证书的重要依据。</p>
              </div>
            </div>
            {mayEnterExam ? (
              <Link className="button primary" href="/apprentice/training/final">
                {examReports.length ? "进入补考" : "进入考场"}
              </Link>
            ) : (
              <span className="badge orange">本次考核不开放补考</span>
            )}
          </div>
        </section>

        <div className="grid three">
          {stages.map((stage, index) => (
            <article className="card" key={stage.title}>
              <span className="badge blue">第{index + 1}关</span>
              <h2 style={{ marginTop: 14 }}>{stage.title}</h2>
              <p className="muted">{stage.detail}</p>
            </article>
          ))}
        </div>

        <div className="grid two">
          <section className="card">
            <div className="section-title">
              <ShieldCheck size={22} />
              <div>
                <h2>通过标准</h2>
                <p>兼顾得分、风险话术和师父审核结果。</p>
              </div>
            </div>
            <ul>
              <li>综合得分不低于80分。</li>
              <li>不得出现重大合规风险话术。</li>
              <li>六维评分中任一关键维度不得低于合格线。</li>
            </ul>
          </section>

          <section className="card">
            <div className="section-title">
              <LockKeyhole size={22} />
              <div>
                <h2>考试规则</h2>
                <p>困难模式，不显示辅助话术，报告由师父审核后发布。</p>
              </div>
            </div>
            <ul>
              <li>考核时长30分钟，最多20轮对话。</li>
              <li>{finalTask?.allowMakeupExam === false ? "本次考核不开放补考，提交后不可再次参加。" : "当前期末考核开放多次补考；每次提交后生成一份独立诊断报告。"}</li>
              <li>该考核任务以最后一次已提交的分数作为当前有效成绩。</li>
              <li>困难模式不显示辅助话术，师父审核后发布正式结果。</li>
            </ul>
          </section>
        </div>

        <section className="card">
          <div className="section-title">
            <RotateCcw size={22} />
            <div>
              <h2>补考进度</h2>
                <p>{finalTask?.allowMakeupExam === false ? "师父已关闭补考权限，本次成绩为唯一有效成绩。" : "可以反复参加，直至达到通过标准或继续冲刺更高成绩。"}</p>
            </div>
          </div>
          <div className="grid three">
            <div className="flat-card"><span className="stat-label">已提交次数</span><span className="stat-value">{examReports.length}</span></div>
            <div className="flat-card"><span className="stat-label">当前有效成绩</span><span className="stat-value">{latest ? `${latest.totalScore}分` : "暂无"}</span></div>
            <div className="flat-card"><span className="stat-label">当前结果</span><span className="stat-value">{latest ? latest.level : "待参加"}</span></div>
          </div>
        </section>

        <section className="card">
          <div className="spread">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <BadgeCheck size={22} />
              <div>
                <h2>出师证书</h2>
                <p>通过后生成班级可展示、可导出的出师证书。</p>
              </div>
            </div>
            <Link className="button success" href="/apprentice/certificate">
              查看证书样式
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
