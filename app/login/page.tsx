import { AppHeader } from "@/components/AppHeader";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;

  return (
    <main>
      <AppHeader />
      <section className="login-hero-section">
        <div className="login-hero-overlay" />
        <div className="container login-hero-content">
          <div className="stack login-copy">
            <div className="section-title">
              <ShieldCheck size={30} />
              <div>
                <h1 style={{ margin: 0 }}>进入岗位实训系统</h1>
                <p className="login-role-lines">
                  <span>管理员进入系统后台。</span>
                  <span>师父进入工作台发布任务。</span>
                  <span>徒弟进入训练台完成实训和出师考核。</span>
                </p>
              </div>
            </div>
          </div>
          <LoginForm nextPath={params.next} />
        </div>
      </section>
    </main>
  );
}
