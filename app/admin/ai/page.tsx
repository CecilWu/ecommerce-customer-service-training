import { KeyRound, Power, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";

export default async function AdminAiListPage() {
  const aiProviders = await prisma.aiProvider.findMany({ orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] });

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">AI模型</span>
          <h1>模型列表</h1>
          <p>查看、启用或删除AI模型配置。删除当前启用模型后，系统会自动启用剩余最近更新的一条。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
              <KeyRound size={22} />
              <div>
                <h2>模型配置</h2>
              <p>训练台会优先调用当前启用模型；如果认证失败，会在训练界面明确提示。</p>
              </div>
            </div>
          </div>
        <div className="admin-list">
          {aiProviders.map((provider) => (
            <div className="admin-list-item" key={provider.id}>
              <div>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <strong>{provider.name}</strong>
                  <span className={`badge ${provider.isActive ? "green" : "blue"}`}>{provider.isActive ? "当前启用" : "备用"}</span>
                  <span className={`badge ${provider.apiKeyEncrypted ? "green" : "orange"}`}>
                    {provider.apiKeyEncrypted ? "API Key已配置" : "未配置API Key"}
                  </span>
                </div>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {provider.provider} · {provider.model} · {provider.baseUrl}
                </p>
              </div>
              <div className="row">
                {!provider.isActive ? (
                  <form action="/api/admin/ai-providers" method="post" style={{ margin: 0 }}>
                    <input type="hidden" name="action" value="activate" />
                    <input type="hidden" name="id" value={provider.id} />
                    <button className="button secondary" type="submit">
                      <Power size={17} />
                      启用
                    </button>
                  </form>
                ) : null}
                <form action="/api/admin/ai-providers" method="post" style={{ margin: 0 }}>
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="id" value={provider.id} />
                  <button className="button warning" type="submit">
                    <Trash2 size={17} />
                    删除
                  </button>
                </form>
              </div>
            </div>
          ))}
          {!aiProviders.length ? <p className="muted">暂无AI模型配置，请先进入“新增模型”。</p> : null}
        </div>
      </section>
    </>
  );
}
