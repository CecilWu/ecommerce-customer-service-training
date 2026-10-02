import { ImageUp, Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth";

export default async function MentorSignaturePage() {
  const user = await requireUser(["MASTER"]);

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">个人设置</span>
          <h1>师父签章</h1>
          <p>上传透明背景PNG签章，用于徒弟出师证书的师父签章区域。</p>
        </div>
      </div>

      <div className="grid two">
        <section className="admin-section">
          <div className="admin-section-head">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <ImageUp size={22} />
              <div>
                <h2>上传签章图片</h2>
                <p>建议使用红色印章或签名章，透明背景，PNG格式，文件不超过2MB。</p>
              </div>
            </div>
          </div>
          <form className="stack" action="/api/mentor/signature" method="post" encType="multipart/form-data">
            <label className="field">
              <span>签章PNG文件</span>
              <input className="input" type="file" name="signature" accept="image/png" required />
            </label>
            <div className="flat-card">
              <strong>上传要求</strong>
              <ul className="muted" style={{ margin: "10px 0 0", paddingLeft: 20 }}>
                <li>必须是PNG格式。</li>
                <li>必须带透明通道或透明块。</li>
                <li>建议画布留白适中，证书上会按比例显示。</li>
              </ul>
            </div>
            <button className="button primary" type="submit">
              <ImageUp size={17} />
              保存师父签章
            </button>
          </form>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Stamp size={22} />
              <div>
                <h2>当前签章预览</h2>
                <p>证书页会优先使用出师考核任务创建师父的签章。</p>
              </div>
            </div>
          </div>
          <div className="signature-preview-box">
            {user.signatureImagePath ? (
              <img className="signature-preview-img" src={user.signatureImagePath} alt={`${user.username}的师父签章`} />
            ) : (
              <div className="placeholder-visual" style={{ minHeight: 180 }}>
                尚未上传师父签章
              </div>
            )}
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            当前师父用户名：{user.username}
          </p>
        </section>
      </div>
    </>
  );
}
