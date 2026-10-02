import { Building2, PlusCircle, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MentorOrganizationUnitsPage() {
  const user = await requireUser(["MASTER"]);
  const units = await prisma.organizationUnit.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">带教组织</span>
          <h1>我的班级/部门</h1>
          <p>创建后，选择该班级/部门注册或导入的徒弟会自动归入你的带教范围。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <PlusCircle size={22} />
            <div><h2>新增班级/部门</h2><p>名称全系统唯一，不能与其他师父已创建的名称重复。</p></div>
          </div>
        </div>
        <form className="stack" action="/api/admin/org-units" method="post">
          <input type="hidden" name="action" value="create" />
          <label className="field">
            <span>班级/部门名称</span>
            <input className="input" name="name" maxLength={60} placeholder="例如 电商客服实训1班 / 企业客服一组" required />
          </label>
          <input type="hidden" name="description" value="" />
          <button className="button primary" type="submit"><PlusCircle size={17} />创建班级/部门</button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Building2 size={22} />
            <div><h2>我创建的班级/部门</h2><p>你只能在发布任务时选择这些单元下的徒弟。</p></div>
          </div>
        </div>
        <div className="grid three">
          {units.map((unit) => (
            <article className="flat-card stack" key={unit.id}>
              <div className="spread"><strong>{unit.name}</strong><span className={`badge ${unit.isActive ? "green" : "red"}`}>{unit.isActive ? "启用" : "停用"}</span></div>
              <form className="stack" action="/api/admin/org-units" method="post">
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="id" value={unit.id} />
                <label className="field"><span>名称</span><input className="input" name="name" defaultValue={unit.name} maxLength={60} required /></label>
                <input type="hidden" name="description" value="" />
                <button className="button secondary" type="submit">保存修改</button>
              </form>
              <div className="row"><UsersRound size={16} /><span className="muted">{unit._count.members} 名徒弟</span></div>
              <form action="/api/admin/org-units" method="post">
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="id" value={unit.id} />
                <button className="button secondary danger-action" type="submit">删除班级/部门</button>
              </form>
            </article>
          ))}
        </div>
        {!units.length ? <p className="muted">还没有创建班级/部门。创建后才可以带教对应徒弟。</p> : null}
      </section>
    </>
  );
}
