import Link from "next/link";
import { ArrowLeft, PencilLine, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NewTaskForm } from "../../new/NewTaskForm";

function parseObjectives(value: string) {
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean).join("；") : "";
  } catch {
    return value;
  }
}

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser(["MASTER"]);
  const { taskId } = await params;
  const [task, products, orgUnits] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, createdById: user.id, isArchived: false },
      include: { product: true }
    }),
    prisma.product.findMany({
      where: { OR: [{ createdById: null }, { createdById: user.id }] },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    }),
    prisma.organizationUnit.findMany({ where: { ownerId: user.id, isActive: true }, orderBy: { name: "asc" } })
  ]);

  if (!task) notFound();

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">任务管理</span>
          <h1>修改实训任务</h1>
          <p>更新任务情境、产品资料和训练规则，已加入徒弟会同步看到最新内容。</p>
        </div>
        <Link className="button secondary" href={`/mentor/tasks/${task.id}`}>
          <ArrowLeft size={17} />
          返回任务详情
        </Link>
      </div>

      <section className="admin-section">
        <div className="section-title">
          <PencilLine size={22} />
          <div>
            <h2>{task.title}</h2>
            <p>保存后会立即同步到徒弟端未开始的训练任务。</p>
          </div>
        </div>
        <NewTaskForm
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            category: product.category,
            description: product.description
          }))}
          orgUnits={orgUnits.map((unit) => ({ id: unit.id, name: unit.name }))}
          task={{
            id: task.id,
            title: task.title,
            type: task.type,
            difficulty: task.difficulty,
            productId: task.productId,
            scenario: task.scenario,
            customerProfile: task.customerProfile,
            orderInfo: (() => {
              try {
                return JSON.parse(task.orderInfoJson) as {
                  orderNo: string; placedAt: string; amount: string; quantity: string; variant: string; logisticsStatus: string; evidenceStatus: string;
                };
              } catch {
                return { orderNo: "", placedAt: "", amount: "", quantity: "", variant: "", logisticsStatus: "", evidenceStatus: "" };
              }
            })(),
            organizationUnitId: task.organizationUnitId ?? "",
            objectives: parseObjectives(task.objectivesJson),
            timeLimit: task.timeLimit,
            roundLimit: task.roundLimit,
            allowRetry: task.allowRetry,
            allowMakeupExam: task.allowMakeupExam,
            showHints: task.showHints,
            reportVisibleMode: task.reportVisibleMode
          }}
        />
      </section>

      <section className="admin-section danger-section">
        <div className="section-title">
          <Trash2 size={22} />
          <div>
            <h2>删除任务</h2>
            <p>删除后徒弟端立即移除该任务，不能再开始新训练；已有训练记录与诊断报告会完整保留。</p>
          </div>
        </div>
        <form className="row" action="/api/tasks" method="post" style={{ alignItems: "end", flexWrap: "wrap" }}>
          <input type="hidden" name="action" value="archive" />
          <input type="hidden" name="taskId" value={task.id} />
          <label className="field" style={{ minWidth: 260, flex: "1 1 280px" }}>
            <span>删除确认</span>
            <input className="input" name="confirmDelete" placeholder="请输入：删除任务" required />
          </label>
          <button className="button secondary danger-action nowrap-button" type="submit">
            <Trash2 size={17} />
            删除任务
          </button>
        </form>
      </section>
    </>
  );
}
