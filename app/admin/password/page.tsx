import { PasswordChangePanel } from "@/components/PasswordChangePanel";
import { requireUser } from "@/lib/auth";

export default async function AdminPasswordPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser(["ADMIN"]);
  const { password } = await searchParams;

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">个人安全</span>
          <h1>修改密码</h1>
          <p>管理员可自行维护登录密码，避免长期使用初始密码。</p>
        </div>
      </div>
      <PasswordChangePanel user={user} returnTo="/admin/password" status={password} />
    </>
  );
}
