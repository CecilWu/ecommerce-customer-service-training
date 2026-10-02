import Link from "next/link";
import { Boxes, PackagePlus, PackageSearch, PencilLine, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function splitLines(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function MentorProductsPage() {
  const user = await requireUser(["MASTER"]);

  const products = await prisma.product.findMany({
    where: { OR: [{ createdById: null }, { createdById: user.id }] },
    include: {
      _count: {
        select: {
          tasks: true,
          faqDocs: true
        }
      }
    },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }]
  });

  const categoryCount = new Set(products.map((product) => product.category)).size;

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">知识与报告</span>
          <h1>产品资料库</h1>
          <p>产品资料用于发布实训任务、AI客户扮演和诊断评分参考，可覆盖日常电商高频品类。</p>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <p className="muted">产品数量</p>
          <strong className="stat-number">{products.length}</strong>
          <p className="muted">可用于发布任务</p>
        </div>
        <div className="card">
          <p className="muted">覆盖品类</p>
          <strong className="stat-number">{categoryCount}</strong>
          <p className="muted">服装、数码、食品、家居等</p>
        </div>
        <div className="card">
          <p className="muted">资料结构</p>
          <strong className="stat-number">3类</strong>
          <p className="muted">说明、FAQ、售后规则</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <PackagePlus size={22} />
            <div>
              <h2>添加产品资料</h2>
              <p>建议每个产品选择一个典型售后冲突点，方便AI客户在实训中追问和施压。</p>
            </div>
          </div>
        </div>
        <form className="stack" action="/api/products" method="post">
          <div className="form-grid">
            <label className="field">
              <span>产品名称</span>
              <input className="input" name="name" placeholder="例如 智能保温杯" required />
            </label>
            <label className="field">
              <span>产品品类</span>
              <input className="input" name="category" placeholder="例如 家居日用" required />
            </label>
          </div>
          <label className="field">
            <span>产品说明</span>
            <textarea className="textarea" name="description" maxLength={180} placeholder="写清楚产品定位、核心功能、规格边界和容易引发客户误解的地方。" required />
            <small className="field-hint">建议控制在180字以内，发布任务页面会展示摘要。</small>
          </label>
          <div className="grid two">
            <label className="field">
              <span>常见FAQ</span>
              <textarea className="textarea" name="faqText" placeholder="每行一条。例如：容量标注为额定容量，实际使用受水位线影响。" />
            </label>
            <label className="field">
              <span>售后规则</span>
              <textarea className="textarea" name="policyText" placeholder="每行一条。例如：非质量问题退换货需保持包装完整并由客户承担寄回运费。" />
            </label>
          </div>
          <button className="button primary nowrap-button" type="submit">
            <PackagePlus size={17} />
            保存产品资料
          </button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <PackageSearch size={22} />
            <div>
              <h2>现有产品资料</h2>
              <p>覆盖日常电商场景，师父发布任务时可直接选择。</p>
            </div>
          </div>
        </div>
        <div className="grid two">
          {products.map((product) => {
            const faqItems = splitLines(product.faqText);
            const policyItems = splitLines(product.policyText);
            const canManage = product.createdById === user.id;
            return (
              <article className="flat-card stack" key={product.id}>
                <div className="spread">
                  <div>
                    <span className="badge blue">{product.category}</span>
                    <span className={`badge ${canManage ? "green" : "orange"}`} style={{ marginLeft: 8 }}>
                      {canManage ? "我的资料" : "系统内置"}
                    </span>
                    <h3 style={{ margin: "10px 0 6px" }}><Link className="table-title-link" href={`/mentor/products/${product.id}`}>{product.name}</Link></h3>
                  </div>
                  <Boxes size={24} />
                </div>
                <p className="muted" style={{ margin: 0 }}>{product.description}</p>
                <div className="grid two">
                  <div>
                    <strong>FAQ {faqItems.length}条</strong>
                    <ul className="compact-list">
                      {faqItems.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>规则 {policyItems.length}条</strong>
                    <ul className="compact-list">
                      {policyItems.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  已关联任务 {product._count.tasks} 个 · 上传FAQ {product._count.faqDocs} 份
                </p>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <Link className="button secondary nowrap-button" href={`/mentor/products/${product.id}`}>查看完整FAQ</Link>
                  {canManage ? (
                    <>
                      <Link className="button secondary nowrap-button" href={`/mentor/products/${product.id}/edit`}>
                        <PencilLine size={16} />
                        修改资料
                      </Link>
                      {product._count.tasks ? (
                        <span className="badge orange">已关联任务，仅可修改</span>
                      ) : (
                        <Link className="button secondary danger-action nowrap-button" href={`/mentor/products/${product.id}/edit?danger=delete`}>
                          <Trash2 size={16} />
                          删除产品
                        </Link>
                      )}
                    </>
                  ) : (
                    <span className="badge blue">共享只读资料</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
