import Link from "next/link";
import { ArrowLeft, BookOpenCheck, PencilLine, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export default async function ProductKnowledgePage({ params }: { params: Promise<{ productId: string }> }) {
  const user = await requireUser(["MASTER"]);
  const { productId } = await params;
  const product = await prisma.product.findFirst({
    where: { id: productId, OR: [{ createdById: null }, { createdById: user.id }] },
    include: { faqDocs: { orderBy: { updatedAt: "desc" } }, _count: { select: { tasks: true } } }
  });
  if (!product) notFound();
  const faq = lines(product.faqText);
  const policies = lines(product.policyText);

  return (
    <>
      <div className="admin-page-title">
        <div><span className="eyebrow">产品客户FAQ知识库</span><h1>{product.name}</h1><p>{product.category} · 已关联任务 {product._count.tasks} 个</p></div>
        <div className="row">
          {product.createdById === user.id ? <Link className="button secondary" href={`/mentor/products/${product.id}/edit`}><PencilLine size={17} />修改资料</Link> : null}
          <Link className="button secondary" href="/mentor/products"><ArrowLeft size={17} />返回产品资料库</Link>
        </div>
      </div>
      <section className="admin-section"><h2>产品说明</h2><p className="lead">{product.description}</p></section>
      <div className="grid two">
        <section className="admin-section">
          <div className="section-title"><BookOpenCheck size={22} /><div><h2>客户高频问题与应对要点</h2><p>AI客户扮演和师父备课共同使用。</p></div></div>
          <ol className="knowledge-list">{faq.map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p></li>)}</ol>
        </section>
        <section className="admin-section">
          <div className="section-title"><ShieldCheck size={22} /><div><h2>售后规则与服务边界</h2><p>用于判断方案是否合规，不直接作为徒弟标准答案。</p></div></div>
          <ol className="knowledge-list policy">{policies.map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p></li>)}</ol>
        </section>
      </div>
      {product.faqDocs.length ? <section className="admin-section"><h2>企业补充资料</h2><div className="admin-list">{product.faqDocs.map((doc) => <div className="admin-list-item" key={doc.id}><strong>{doc.title}</strong><span className="badge blue">{doc.sourceType}</span></div>)}</div></section> : null}
    </>
  );
}
