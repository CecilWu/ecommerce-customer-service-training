import { Building2, FileSpreadsheet, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSuperAdmin } from "@/lib/permissions";

export default async function AdminAccountCreatePage() {
  const currentUser = await requireUser(["ADMIN"]);
  const [units, masters] = await Promise.all([
    prisma.organizationUnit.findMany({ where: { isActive: true, ownerId: { not: null } }, include: { owner: { select: { username: true } } }, orderBy: { name: "asc" } }),
    prisma.user.count({ where: { role: "MASTER", isActive: true } })
  ]);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">账号权限</span>
          <h1>添加账号</h1>
          <p>用户名即用户显示名称。师父和管理员不归属班级/部门；徒弟必须选择有效的班级/部门。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <UserPlus size={22} /><div><h2>账号信息</h2><p>角色在创建后锁定；如需变更，请删除账号后重新创建。</p></div>
          </div>
        </div>
        <form className="stack" action="/api/admin/users" method="post">
          <div className="form-grid">
            <label className="field"><span>用户名</span><input className="input" name="username" maxLength={40} placeholder="中文、英文、数字或混合，必须唯一" required /></label>
            <label className="field"><span>初始密码</span><input className="input" name="password" placeholder="建议首次登录后修改" required /></label>
            <label className="field">
              <span>角色</span>
              <select className="select" name="role" defaultValue="APPRENTICE">
                {isSuperAdmin(currentUser) ? <option value="ADMIN">管理员</option> : null}
                <option value="MASTER">师父</option>
                <option value="APPRENTICE">徒弟</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>班级/部门（仅徒弟必填）</span>
            <select className="select" name="organizationUnitId" defaultValue={units[0]?.id ?? ""}>
              <option value="">不绑定班级/部门</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.owner ? ` · ${unit.owner.username}` : " · 未分配师父"}</option>)}
            </select>
          </label>
          {!units.length ? <div className="flat-card"><div className="row"><Building2 size={18} /><strong>暂未创建班级/部门</strong></div><p className="muted" style={{ margin: "8px 0 12px" }}>仍可创建师父或管理员账号；创建徒弟前需要师父先创建班级/部门。</p></div> : null}
          {!masters ? <p className="badge orange">当前没有启用师父，请先创建师父账号后再创建班级/部门和徒弟。</p> : null}
          <button className="button primary" type="submit"><UserPlus size={17} />添加账号</button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-head"><div className="section-title" style={{ marginBottom: 0 }}><FileSpreadsheet size={22} /><div><h2>批量导入徒弟账号</h2><p>上传.csv文件，每行三列：用户名、密码、所属班级/部门。导入后默认角色为徒弟。</p></div></div></div>
        <form className="stack" action="/api/admin/users" method="post" encType="multipart/form-data">
          <input type="hidden" name="action" value="import" />
          <label className="field"><span>CSV文件</span><input className="input" type="file" name="csvFile" accept=".csv,text/csv" required /></label>
          <label className="field"><span>CSV内容预览/备用粘贴</span><textarea className="textarea" name="rows" placeholder={"zhangsan,wuxiaobo,电商客服实训1班\nlisi,123456,电商客服实训1班\n王五,888888,企业客服一组"} /></label>
          <div className="flat-card"><strong>导入规则</strong><p className="muted" style={{ margin: "8px 0 0" }}>第一列用户名，第二列密码，第三列班级/部门名称。第三列必须和师父已创建的名称完全一致；导入后徒弟自动归属该班级/部门的创建师父。</p><p className="muted" style={{ margin: "8px 0 0" }}>当前可用班级/部门：{units.map((unit) => `${unit.name}（${unit.owner?.username ?? "未分配师父"}）`).join("；") || "暂无，请先由师父创建。"}</p></div>
          <button className="button primary" type="submit" disabled={!units.length}><FileSpreadsheet size={17} />批量导入徒弟</button>
        </form>
      </section>
    </>
  );
}
