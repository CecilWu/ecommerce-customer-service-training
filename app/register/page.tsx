import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { GraduationCap } from "lucide-react";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const currentUser = await getCurrentUser();
  if (currentUser) redirect(roleHome(currentUser.role));

  const classes = await prisma.organizationUnit.findMany({
    where: { isActive: true, ownerId: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return (
    <main>
      <AppHeader />
      <section className="login-hero-section register-hero-section">
        <div className="login-hero-overlay" />
        <div className="container login-hero-content">
          <div className="stack login-copy">
            <div className="section-title">
              <GraduationCap size={30} />
              <div>
                <h1 style={{ margin: 0 }}>注册徒弟实训账号</h1>
                <p className="login-role-lines">
                  <span>用户名就是你的系统姓名。</span>
                  <span>选择班级/部门后，自动归入对应师父门下并进入徒弟训练台。</span>
                  <span>师父与管理员账号仍由管理员后台统一创建和管理。</span>
                </p>
              </div>
            </div>
          </div>
          <RegisterForm classes={classes} />
        </div>
      </section>
    </main>
  );
}
