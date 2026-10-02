import { KeyRound, Save, Trash2, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSuperAdmin, roleLabel } from "@/lib/permissions";
import { BulkAccountActions } from "./BulkAccountActions";

export default async function AdminAccountsPage() {
  const currentUser = await requireUser(["ADMIN"]);
  const superAdmin = isSuperAdmin(currentUser);
  const [users, units] = await Promise.all([
    prisma.user.findMany({
      include: { organizationUnit: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "desc" }]
    }),
    prisma.organizationUnit.findMany({ where: { isActive: true, ownerId: { not: null } }, orderBy: { name: "asc" } })
  ]);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">账号权限</span>
          <h1>账号列表</h1>
          <p>账号创建后角色不可修改。徒弟通过班级/部门自动建立师徒归属；管理员和师父不归属班级/部门。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <UsersRound size={22} />
            <div>
              <h2>全体账号</h2>
              <p>勾选多个账号可批量重置密码或删除。批量删除需输入“吴晓波”确认。</p>
            </div>
          </div>
          <BulkAccountActions />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>选择</th><th>用户名</th><th>角色</th><th>班级/部门</th><th>新密码</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const updateFormId = `update-${user.id}`;
                const canManage = user.role !== "ADMIN" || superAdmin;
                const canDelete = canManage && user.id !== currentUser.id && user.username !== "admin" && user.isActive;
                return (
                  <tr key={user.username}>
                    <td><input form="bulk-actions-form" name="usernames" type="checkbox" value={user.username} disabled={!canDelete} /></td>
                    <td><strong>{user.username}</strong></td>
                    <td><span className={`badge ${user.role === "ADMIN" ? "red" : user.role === "MASTER" ? "blue" : "green"}`}>{roleLabel(user.role)}</span></td>
                    <td>
                      {user.role === "APPRENTICE" ? (
                        <select className="select compact-input" form={updateFormId} name="organizationUnitId" defaultValue={user.organizationUnitId ?? ""} required>
                          <option value="" disabled>选择班级/部门</option>
                          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                      ) : <span className="muted">-</span>}
                    </td>
                    <td><input className="input compact-input" form={updateFormId} name="password" placeholder="留空不修改" disabled={!canManage} /></td>
                    <td>{user.isActive ? <span className="badge green">启用</span> : <span className="badge red">已停用</span>}</td>
                    <td>
                      <div className="row" style={{ flexWrap: "wrap" }}>
                        <form id={updateFormId} action="/api/admin/users" method="post">
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="username" value={user.username} />
                          <button className="button secondary nowrap-button" type="submit" disabled={!canManage}><Save size={16} />保存</button>
                        </form>
                        <form action="/api/admin/users" method="post">
                          <input type="hidden" name="action" value="reset" />
                          <input type="hidden" name="username" value={user.username} />
                          <button className="button warning nowrap-button" type="submit" disabled={!canManage}><KeyRound size={16} />重置</button>
                        </form>
                        <form action="/api/admin/users" method="post">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="username" value={user.username} />
                          <button className="button secondary danger-action nowrap-button" type="submit" disabled={!canDelete}><Trash2 size={16} />删除</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
