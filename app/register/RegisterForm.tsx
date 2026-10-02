"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

type ClassOption = {
  id: string;
  name: string;
};

export function RegisterForm({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organizationUnitId, setOrganizationUnitId] = useState(classes[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword, organizationUnitId })
      });
      const result = (await response.json()) as { error?: string; user?: { role: string } };
      if (!response.ok || !result.user) throw new Error(result.error || "注册失败");

      router.push("/apprentice");
      router.refresh();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <h2 style={{ marginBottom: 8 }}>注册徒弟账号</h2>
        <p className="muted" style={{ marginBottom: 0 }}>注册后自动成为徒弟，并归入所选班级/部门创建师父的带教范围。</p>
      </div>
      <label className="field">
        <span>用户名</span>
        <input
          className="input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="中文、英文、数字或混合"
          autoComplete="username"
          maxLength={40}
          required
        />
        <small className="field-hint">用户名即姓名，全系统唯一，不支持空格和特殊符号。</small>
      </label>
      <label className="field">
        <span>所属班级/部门</span>
        <select
          className="select"
          value={organizationUnitId}
          onChange={(event) => setOrganizationUnitId(event.target.value)}
          disabled={!classes.length}
          required
        >
          {classes.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>设置密码</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>
      <label className="field">
        <span>确认密码</span>
        <input
          className="input"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>
      {!classes.length ? <p className="badge red">当前没有可注册班级/部门，请联系师父先创建并由管理员确认归属。</p> : null}
      {error ? <p className="badge red">{error}</p> : null}
      <button className="button primary" type="submit" disabled={busy || !classes.length}>
        <UserPlus size={17} />
        {busy ? "注册中" : "注册并进入训练台"}
      </button>
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        已有账号？ <Link href="/login" style={{ color: "var(--blue)", fontWeight: 900 }}>返回登录</Link>
      </p>
    </form>
  );
}
