import { ArrowRightLeft, Building2, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";

export default async function AdminOrgUnitsPage() {
  const [units, masters] = await Promise.all([
    prisma.organizationUnit.findMany({
      include: { owner: { select: { username: true } }, _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({
      where: { role: "MASTER", isActive: true },
      select: { id: true, username: true },
      orderBy: { username: "asc" }
    })
  ]);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">账号权限</span>
          <h1>班级/部门管理</h1>
          <p>班级/部门由师父创建并专属带教。管理员可查看全量数据、调整归属师父或删除无效单元。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Building2 size={22} />
            <div>
              <h2>全部班级/部门</h2>
              <p>删除后会自动解除徒弟归属，不会删除徒弟账号和历史训练记录。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>班级/部门名称</th>
                <th>创建师父</th>
                <th>创建时间</th>
                <th>徒弟数量</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td><strong>{unit.name}</strong><div className="muted" style={{ marginTop: 4 }}>{unit.description || "-"}</div></td>
                  <td>{unit.owner?.username ?? <span className="badge red">未分配师父</span>}</td>
                  <td>{unit.createdAt.toLocaleString("zh-CN")}</td>
                  <td>{unit._count.members}人</td>
                  <td>{unit.isActive ? <span className="badge green">启用</span> : <span className="badge red">停用</span>}</td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <form className="row" action="/api/admin/org-units" method="post">
                        <input type="hidden" name="action" value="reassign" />
                        <input type="hidden" name="id" value={unit.id} />
                        <select className="select compact-input" name="ownerId" defaultValue={unit.ownerId ?? ""} required>
                          <option value="" disabled>选择师父</option>
                          {masters.map((master) => <option key={master.id} value={master.id}>{master.username}</option>)}
                        </select>
                        <button className="button secondary nowrap-button" type="submit" disabled={!masters.length}>
                          <ArrowRightLeft size={16} />调整归属
                        </button>
                      </form>
                      <form action="/api/admin/org-units" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={unit.id} />
                        <button className="button secondary danger-action nowrap-button" type="submit">
                          <Trash2 size={16} />删除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!units.length ? <p className="muted">暂时没有师父创建班级/部门。</p> : null}
        </div>
      </section>
    </>
  );
}
