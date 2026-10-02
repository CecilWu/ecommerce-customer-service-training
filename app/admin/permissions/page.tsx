import { ClipboardList } from "lucide-react";

export default function AdminPermissionsPage() {
  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">账号权限</span>
          <h1>权限边界</h1>
          <p>用企业岗位分工隔离系统后台、带教工作台和学生训练台，避免三类角色互相混用。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
              <ClipboardList size={22} />
              <div>
                <h2>三角色权限规则</h2>
              <p>超级管理员创建管理员；管理员创建师父和徒弟；师父仅管理自己创建班级/部门下的徒弟与任务。</p>
              </div>
            </div>
          </div>
        <div className="grid three">
          <div className="flat-card">
            <span className="badge red">管理员</span>
            <h2 style={{ marginTop: 12 }}>系统后台</h2>
            <p className="muted">负责账号、AI模型和系统级规则配置；可调配班级/部门归属。账号创建后角色锁定，只有超级管理员可创建管理员。</p>
          </div>
          <div className="flat-card">
            <span className="badge blue">师父</span>
            <h2 style={{ marginTop: 12 }}>师父工作台</h2>
            <p className="muted">创建并管理自己的班级/部门，只向本单元徒弟发布任务，查看自己任务下的训练记录与诊断报告。</p>
          </div>
          <div className="flat-card">
            <span className="badge green">徒弟</span>
            <h2 style={{ marginTop: 12 }}>徒弟训练台</h2>
            <p className="muted">只能看到自己被加入的任务，只能提交自己的训练和评分报告。</p>
          </div>
        </div>
      </section>
    </>
  );
}
