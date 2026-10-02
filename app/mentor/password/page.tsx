import { PasswordChangePanel } from "@/components/PasswordChangePanel";
import { requireUser } from "@/lib/auth";

export default async function MentorPasswordPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser(["MASTER"]);
  const { password } = await searchParams;

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">个人设置</span>
          <h1>修改密码</h1>
          <p>师父可自行维护登录密码，不必等待管理员重置。</p>
        </div>
      </div>
      <PasswordChangePanel user={user} returnTo="/mentor/password" status={password} />
    </>
  );
}
