import Link from "next/link";
import { ClipboardList, FilePlus2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const typeLabel = {
  DAILY: "日常训练",
  ASSESSMENT: "阶段测评",
  EXAM: "出师考核"
};

const difficultyLabel = {
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难"
};

export default async function MentorTasksPage() {
  const user = await requireUser(["MASTER"]);
  const tasks = await prisma.task.findMany({
    where: { createdById: user.id, isArchived: false },
    include: { product: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">任务管理</span>
          <h1>任务列表</h1>
          <p>管理自己发布的训练、阶段测评和正式出师考核任务。</p>
        </div>
        <Link className="button primary" href="/mentor/tasks/new">
          <FilePlus2 size={17} />
          发布任务
        </Link>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <ClipboardList size={22} />
            <div>
              <h2>任务池</h2>
              <p>师父可为任务继续加入徒弟，并查看任务下的训练表现。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>任务</th>
                <th>类型</th>
                <th>难度</th>
                <th>发布时间</th>
                <th>时长</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link className="table-title-link" href={`/mentor/tasks/${task.id}`}>
                      {task.title}
                    </Link>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {task.product.name} · {task.scenario}
                    </div>
                  </td>
                  <td>{typeLabel[task.type]}</td>
                  <td>
                    <span className={`badge nowrap-badge ${task.difficulty === "HARD" ? "red" : task.difficulty === "MEDIUM" ? "orange" : "green"}`}>
                      {difficultyLabel[task.difficulty]}
                    </span>
                  </td>
                  <td className="nowrap-cell">{task.createdAt.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td>{task.timeLimit}分钟</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tasks.length ? <p className="muted">还没有发布任务，请先从左侧进入“发布任务”。</p> : null}
        </div>
      </section>
    </>
  );
}
