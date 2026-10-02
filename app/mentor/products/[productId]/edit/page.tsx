import Link from "next/link";
import { ArrowLeft, PackageSearch, Save, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function EditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const user = await requireUser(["MASTER"]);
  const { productId } = await params;
  const product = await prisma.product.findFirst({
    where: { id: productId, createdById: user.id },
    include: { _count: { select: { tasks: true, faqDocs: true } } }
  });
  if (!product) notFound();

  const canDelete = product._count.tasks === 0;
  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">知识与报告</span>
          <h1>修改产品资料</h1>
          <p>产品资料会作为任务情境、AI客户扮演和评分诊断的知识参考。</p>
        </div>
        <Link className="button secondary" href="/mentor/products">
          <ArrowLeft size={17} />
          返回产品资料库
        </Link>
      </div>

      <section className="admin-section">
        <div className="section-title">
          <PackageSearch size={22} />
          <div>
            <h2>{product.name}</h2>
            <p>已关联任务 {product._count.tasks} 个 · 关联FAQ {product._count.faqDocs} 份</p>
          </div>
        </div>
        <form className="stack" action="/api/products" method="post">
          <input type="hidden" name="action" value="update" />
          <input type="hidden" name="productId" value={product.id} />
          <div className="form-grid">
            <label className="field">
              <span>产品名称</span>
              <input className="input" name="name" defaultValue={product.name} required />
            </label>
            <label className="field">
              <span>产品品类</span>
              <input className="input" name="category" defaultValue={product.category} required />
            </label>
          </div>
          <label className="field">
            <span>产品说明</span>
            <textarea className="textarea" name="description" maxLength={180} defaultValue={product.description} required />
            <small className="field-hint">建议控制在180字以内，避免徒弟端任务信息过长。</small>
          </label>
          <div className="grid two">
            <label className="field">
              <span>常见FAQ</span>
              <textarea className="textarea" name="faqText" defaultValue={product.faqText} />
            </label>
            <label className="field">
              <span>售后规则</span>
              <textarea className="textarea" name="policyText" defaultValue={product.policyText} />
            </label>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="button primary nowrap-button" type="submit">
              <Save size={17} />
              保存修改
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section danger-section">
        <div className="section-title">
          <Trash2 size={22} />
          <div>
            <h2>删除产品资料</h2>
            <p>{canDelete ? "未关联任何任务，可以删除。删除不会影响其他已脱离关联的FAQ资料。" : "该产品已关联任务或训练历史，为保证报告和任务证据完整，只允许修改，不能删除。"}</p>
          </div>
        </div>
        {canDelete ? (
          <form className="row" action="/api/products" method="post" style={{ alignItems: "end", flexWrap: "wrap" }}>
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="productId" value={product.id} />
            <label className="field" style={{ minWidth: 260, flex: "1 1 280px" }}>
              <span>删除确认</span>
              <input className="input" name="confirmDelete" placeholder="请输入：删除产品" required />
            </label>
            <button className="button secondary danger-action nowrap-button" type="submit">
              <Trash2 size={17} />
              删除产品
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}
