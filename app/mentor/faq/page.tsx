import { UploadCloud } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MentorFaqPage() {
  const user = await requireUser(["MASTER"]);
  const products = await prisma.product.findMany({
    where: { OR: [{ createdById: null }, { createdById: user.id }] },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">知识与报告</span>
          <h1>企业FAQ知识库</h1>
          <p>企业FAQ只作为AI客户扮演和评分诊断的知识参考，不直接泄露给徒弟作为标准答案。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <UploadCloud size={22} />
            <div>
              <h2>上传FAQ资料</h2>
              <p>支持文本文件上传或直接粘贴企业产品规则、售后政策和常见问答。</p>
            </div>
          </div>
        </div>
        <form action="/api/faq" method="post" encType="multipart/form-data" className="stack">
          <div className="form-grid">
            <label className="field">
              <span>资料标题</span>
              <input className="input" name="title" defaultValue="企业产品FAQ" />
            </label>
            <label className="field">
              <span>关联产品</span>
              <select className="select" name="productId" defaultValue={products[0]?.id}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>上传文本文件</span>
            <input className="input" type="file" name="file" accept=".txt,.md,.csv" />
          </label>
          <label className="field">
            <span>或直接粘贴FAQ</span>
            <textarea className="textarea" name="content" placeholder="粘贴企业产品规则、售后政策、常见问答..." />
          </label>
          <button className="button primary" type="submit">
            <UploadCloud size={17} />
            上传FAQ
          </button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>产品知识概况</h2>
            <p className="muted">展示当前内置产品及其FAQ、规则条目数量。</p>
          </div>
        </div>
        <div className="grid two">
          {products.map((product) => (
            <div className="flat-card" key={product.id}>
              <div className="spread">
                <strong>{product.name}</strong>
                <span className="badge blue">{product.category}</span>
              </div>
              <p className="muted" style={{ margin: "10px 0 0" }}>
                FAQ {product.faqText.split("\n").filter(Boolean).length}条 · 规则 {product.policyText.split("\n").filter(Boolean).length}条
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
