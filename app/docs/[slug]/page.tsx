import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MarkdownReader } from "@/components/MarkdownReader";
import { requireUser } from "@/lib/auth";
import { readResearchDoc } from "@/lib/docs";

export const dynamic = "force-dynamic";

export default async function DocReaderPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser(["MASTER", "ADMIN"]);

  const { slug } = await params;
  const result = await readResearchDoc(slug);
  if (!result) notFound();

  return (
    <main className="role-theme role-mentor">
      <AppHeader
        roleLabel="资料库"
        actions={
          <Link className="button secondary nowrap-button" href="/docs">
            <ArrowLeft size={17} />
            返回资料库
          </Link>
        }
      />
      <section className="container stack">
        <div className="admin-page-title">
          <div>
            <span className="eyebrow">Markdown在线阅读</span>
            <h1>{result.doc.title}</h1>
            <p>{result.doc.detail}</p>
          </div>
          <Link className="button secondary nowrap-button" href={`/api/docs/${result.doc.slug}?download=1`}>
            <Download size={17} />
            下载.md
          </Link>
        </div>
        <section className="admin-section markdown-shell">
          <MarkdownReader content={result.content} />
        </section>
      </section>
    </main>
  );
}
