import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NewTaskForm } from "./NewTaskForm";

export default async function NewTaskPage() {
  const user = await requireUser(["MASTER"]);
  const [products, orgUnits] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ createdById: null }, { createdById: user.id }] },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    }),
    prisma.organizationUnit.findMany({ where: { ownerId: user.id, isActive: true }, orderBy: { name: "asc" } })
  ]);
  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description
  }));
  const orgUnitOptions = orgUnits.map((unit) => ({
    id: unit.id,
    name: unit.name
  }));

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">任务管理</span>
          <h1>发布客服实训任务</h1>
          <p>字段按企业训练任务单设计，保存后会进入任务列表。</p>
        </div>
      </div>

      <section className="admin-section">
        <NewTaskForm products={productOptions} orgUnits={orgUnitOptions} />
      </section>
    </>
  );
}
