import Link from "next/link";
import { BookOpenText, Download, FileText } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { researchDocs } from "@/lib/docs";

export default async function DocsPage() {
  await requireUser(["MASTER", "ADMIN"]);

  return (
    <main className="role-theme role-mentor">
      <AppHeader roleLabel="资料库" />

      <section className="container stack">
        <div className="admin-page-title">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <BookOpenText size={28} />
            <div>
              <span className="eyebrow">师父教研沉淀</span>
              <h1>教研资料库</h1>
              <p>Markdown资料已保存在项目docs目录，可在线阅读，也可下载留档。</p>
            </div>
          </div>
        </div>

        <div className="grid two">
          {researchDocs.map((doc) => (
            <article className="admin-section doc-card" key={doc.slug}>
              <Link className="doc-card-main" href={`/docs/${doc.slug}`}>
                <div className="row">
                  <FileText size={22} />
                  <h2 style={{ margin: 0 }}>{doc.title}</h2>
                </div>
                <p className="muted" style={{ margin: "12px 0" }}>
                  {doc.detail}
                </p>
                <code>docs/{doc.fileName}</code>
              </Link>
              <div className="row doc-card-actions">
                <Link className="button secondary nowrap-button" href={`/docs/${doc.slug}`}>
                  在线阅读
                </Link>
                <Link className="button secondary nowrap-button" href={`/api/docs/${doc.slug}?download=1`}>
                  <Download size={16} />
                  下载
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
