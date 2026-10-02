import Link from "next/link";
import { Clock, MessageSquareWarning, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const typeLabel = {
  DAILY: "日常训练",
  ASSESSMENT: "阶段测评",
  EXAM: "正式出师考核"
};

const difficultyLabel = {
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难"
};

export default async function ApprenticeTasksPage() {
  const user = await requireUser(["APPRENTICE"]);
  const tasks = await prisma.task.findMany({
    where: {
      isArchived: false,
      OR: [
        { enrollments: { some: { userId: user.id } } },
        ...(user.organizationUnitId ? [{ organizationUnitId: user.organizationUnitId }] : [])
      ]
    },
    include: { product: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <section className="container stack">
        <div className="section-title">
          <Target size={26} />
          <div>
            <h1 style={{ margin: 0 }}>客服实训任务</h1>
            <p>选择任务后进入AI客户接待实训室。</p>
          </div>
        </div>

        <div className="grid three">
          {!tasks.length ? (
            <section className="card">
              <h2>暂无任务</h2>
              <p className="muted">当前还没有师父把你加入任务，请等待师父发布或分配。</p>
            </section>
          ) : null}
          {tasks.map((task) => {
            const objectives = JSON.parse(task.objectivesJson) as string[];
            return (
              <article className="card stack task-card" key={task.id}>
                <div className="spread">
                  <span className={`badge ${task.difficulty === "HARD" ? "red" : task.difficulty === "MEDIUM" ? "orange" : "green"}`}>
                    {difficultyLabel[task.difficulty]}
                  </span>
                  <span className="badge blue">{typeLabel[task.type]}</span>
                </div>
                <h2 style={{ marginBottom: 0 }}>{task.title}</h2>
                <p className="muted">{task.scenario}</p>
                <div className="row">
                  <MessageSquareWarning size={18} />
                  <span>{task.product.name}</span>
                </div>
                <div className="row">
                  <Clock size={18} />
                  <span>
                    {task.timeLimit}分钟 · {task.roundLimit}轮
                  </span>
                </div>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {objectives.map((objective) => (
                    <span className="badge blue" key={objective}>
                      {objective}
                    </span>
                  ))}
                </div>
                <Link className="button primary task-card-action" href={`/apprentice/training/${task.id}`}>
                  进入实训室
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
