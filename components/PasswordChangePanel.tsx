import { KeyRound, Save, ShieldCheck } from "lucide-react";
import type { AuthUser } from "@/lib/auth";

const statusText: Record<string, { title: string; detail: string; tone: "green" | "orange" | "red" }> = {
  updated: {
    title: "密码已修改",
    detail: "下次登录请使用新密码。当前登录状态会继续保留。",
    tone: "green"
  },
  missing: {
    title: "请填写完整",
    detail: "原密码、新密码和确认密码都不能为空。",
    tone: "red"
  },
  mismatch: {
    title: "两次新密码不一致",
    detail: "请重新输入并确认新密码。",
    tone: "red"
  },
  weak: {
    title: "新密码过短",
    detail: "为了账号安全，新密码至少需要6位。",
    tone: "orange"
  },
  same: {
    title: "新密码不能与原密码相同",
    detail: "请设置一个新的密码。",
    tone: "orange"
  },
  old: {
    title: "原密码不正确",
    detail: "系统需要先确认当前账号身份。",
    tone: "red"
  },
  invalid: {
    title: "账号状态异常",
    detail: "请重新登录后再修改密码。",
    tone: "red"
  }
};

export function PasswordChangePanel({
  user,
  returnTo,
  status
}: {
  user: AuthUser;
  returnTo: string;
  status?: string;
}) {
  const message = status ? statusText[status] : null;

  return (
    <section className="admin-section password-panel">
      <div className="section-title">
        <KeyRound size={24} />
        <div>
          <h2>修改登录密码</h2>
          <p>当前用户名：{user.username}</p>
        </div>
      </div>

      {message ? (
        <div className={`flat-card password-message password-message-${message.tone}`}>
          <strong>{message.title}</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>{message.detail}</p>
        </div>
      ) : null}

      <form className="stack" action="/api/account/password" method="post">
        <input name="returnTo" type="hidden" value={returnTo} />
        <div className="form-grid">
          <label className="field">
            <span>原密码</span>
            <input className="input" name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label className="field">
            <span>新密码</span>
            <input className="input" name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
          </label>
          <label className="field">
            <span>确认新密码</span>
            <input className="input" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
          </label>
        </div>

        <div className="flat-card">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <ShieldCheck size={20} />
            <div>
              <strong>账号安全建议</strong>
              <p>建议使用不少于6位的独立密码，不要与其他平台共用；管理员重置初始密码后，首次登录应尽快修改。</p>
            </div>
          </div>
        </div>

        <button className="button primary nowrap-button" type="submit">
          <Save size={17} />
          保存新密码
        </button>
      </form>
    </section>
  );
}
