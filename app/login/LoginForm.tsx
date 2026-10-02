"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import Link from "next/link";

function homeForRole(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "MASTER") return "/mentor";
  return "/apprentice";
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const result = (await response.json()) as { error?: string; user?: { role: string } };
      if (!response.ok || !result.user) throw new Error(result.error || "登录失败");

      const roleHome = homeForRole(result.user.role);
      const safeNextPath = nextPath?.startsWith(roleHome) ? nextPath : roleHome;
      router.push(safeNextPath);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <label className="field">
        <span>用户名</span>
        <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error ? <p className="badge red">{error}</p> : null}
      <button className="button primary" type="submit" disabled={busy}>
        <LogIn size={17} />
        {busy ? "登录中" : "登录"}
      </button>
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        还没有徒弟账号？ <Link href="/register" style={{ color: "var(--blue)", fontWeight: 900 }}>注册徒弟账号</Link>
      </p>
    </form>
  );
}
