import { KeyRound } from "lucide-react";
import { PasswordChangePanel } from "@/components/PasswordChangePanel";
import { requireUser } from "@/lib/auth";

export default async function ApprenticePasswordPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser(["APPRENTICE"]);
  const { password } = await searchParams;

  return (
    <>
      <section className="container stack">
        <div className="section-title">
          <KeyRound size={26} />
          <div>
            <h1 style={{ margin: 0 }}>账号安全</h1>
            <p>徒弟可自行修改登录密码，管理员重置后也应尽快更换为个人密码。</p>
          </div>
        </div>
        <PasswordChangePanel user={user} returnTo="/apprentice/password" status={password} />
      </section>
    </>
  );
}
