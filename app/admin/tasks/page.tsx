import { ListChecks } from "lucide-react";
import { prisma } from "@/lib/db";
import { roleLabel } from "@/lib/permissions";

const typeLabel = {
  DAILY: "日常训练",
  ASSESSMENT: "阶段测评",
  EXAM: "出师考核"
};

const typeBadgeClass = {
  DAILY: "green",
  ASSESSMENT: "orange",
  EXAM: "red"
};

const difficultyLabel = {
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难"
};

export default async function AdminTasksPage() {
  const tasks = await prisma.task.findMany({
    include: {
      product: true,
      createdBy: true,
      enrollments: true,
      sessions: true
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">系统总览</span>
          <h1>任务总览</h1>
          <p>管理员只查看全平台任务数据，不进入师父工作台执行业务任务。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <ListChecks size={22} />
            <div>
              <h2>全部任务</h2>
              <p>按创建时间倒序展示任务、产品、师父、加入徒弟和训练记录。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>序号</th>
                <th>任务</th>
                <th>产品</th>
                <th>类型</th>
                <th>难度</th>
                <th>创建师父</th>
                <th>徒弟</th>
                <th>训练</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{task.title}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>{task.scenario}</div>
                  </td>
                  <td>{task.product.name}</td>
                  <td><span className={`badge nowrap-badge ${typeBadgeClass[task.type]}`}>{typeLabel[task.type]}</span></td>
                  <td><span className={`badge nowrap-badge ${task.difficulty === "HARD" ? "red" : task.difficulty === "MEDIUM" ? "orange" : "green"}`}>{difficultyLabel[task.difficulty]}</span></td>
                  <td>{task.createdBy ? `${task.createdBy.username} · ${roleLabel(task.createdBy.role)}` : "未绑定"}</td>
                  <td>{task.enrollments.length}人</td>
                  <td>{task.sessions.length}次</td>
                  <td>{task.createdAt.toLocaleString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tasks.length ? <p className="muted">当前还没有任务。</p> : null}
        </div>
      </section>
    </>
  );
}
