import Link from "next/link";
import { BadgeCheck, Search, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { prisma } from "@/lib/db";

export default async function CertificateVerifyPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = String(q || "").trim();
  const certificate = query
    ? await prisma.certificate.findFirst({
        where: { certificateNo: { contains: query } },
        include: { user: true },
        orderBy: { issuedAt: "desc" }
      })
    : null;

  return (
    <main>
      <AppHeader roleLabel="证书核验" hideWorkspaceLink />
      <section className="container stack">
        <div className="section-title">
          <ShieldCheck size={26} />
          <div>
            <h1 style={{ margin: 0 }}>出师证书核验</h1>
            <p>输入证书编号，查询电商客服岗位实训出师认证结果。</p>
          </div>
        </div>

        <section className="card">
          <form className="row" action="/certificate/verify" method="get" style={{ alignItems: "stretch" }}>
            <input className="input" name="q" defaultValue={query} placeholder="例如 ECS-2026-XXXXXX" style={{ flex: 1 }} />
            <button className="button primary nowrap-button" type="submit">
              <Search size={17} />
              查询证书
            </button>
          </form>
        </section>

        {query ? (
          certificate ? (
            <section className="card">
              <div className="section-title">
                <BadgeCheck size={24} color="var(--green)" />
                <div>
                  <h2>核验通过</h2>
                  <p>该证书为系统已签发的有效出师认证记录。</p>
                </div>
              </div>
              <div className="grid three">
                <div className="flat-card">
                  <span className="stat-label">持证人</span>
                  <strong>{certificate.user.username}</strong>
                  <p className="muted" style={{ margin: "6px 0 0" }}>{certificate.user.className ?? "未记录班级/部门"}</p>
                </div>
                <div className="flat-card">
                  <span className="stat-label">证书等级</span>
                  <strong>{certificate.level}</strong>
                  <p className="muted" style={{ margin: "6px 0 0" }}>{certificate.finalScore}分</p>
                </div>
                <div className="flat-card">
                  <span className="stat-label">签发时间</span>
                  <strong>{certificate.issuedAt.toLocaleDateString("zh-CN")}</strong>
                  <p className="muted" style={{ margin: "6px 0 0" }}>{certificate.title}</p>
                </div>
              </div>
              <div className="flat-card">
                <span className="stat-label">证书编号</span>
                <h3 style={{ margin: "8px 0 0" }}>{certificate.certificateNo}</h3>
              </div>
            </section>
          ) : (
            <section className="card">
              <h2>未查询到证书</h2>
              <p className="muted">请确认编号是否完整，或联系师父/管理员核对出师考核审核状态。</p>
            </section>
          )
        ) : (
          <section className="card">
            <h2>核验说明</h2>
            <p className="muted">证书编号可在徒弟端出师证书页面、师父端证书管理页面中查看。</p>
            <Link className="button secondary nowrap-button" href="/">
              返回首页
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
