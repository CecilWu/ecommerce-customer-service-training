import Link from "next/link";
import { Award, BadgeCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MentorCertificatesPage() {
  const user = await requireUser(["MASTER"]);
  const certificates = await prisma.certificate.findMany({
    where: {
      user: {
        taskEnrollments: {
          some: {
            task: { createdById: user.id }
          }
        }
      }
    },
    include: { user: true },
    orderBy: { issuedAt: "desc" }
  });

  const excellentCount = certificates.filter((certificate) => certificate.finalScore >= 90).length;

  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">出师认证</span>
          <h1>证书管理</h1>
          <p>查看自己带教范围内已生成的出师证书，可复制证书编号进行公开核验。</p>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <p className="muted">证书数量</p>
          <strong className="stat-number">{certificates.length}</strong>
          <p className="muted">已通过出师考核</p>
        </div>
        <div className="card">
          <p className="muted">优秀证书</p>
          <strong className="stat-number">{excellentCount}</strong>
          <p className="muted">90分及以上</p>
        </div>
        <div className="card">
          <p className="muted">核验方式</p>
          <strong className="stat-number">编号</strong>
          <p className="muted">公开页面查询</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Award size={22} />
            <div>
              <h2>证书列表</h2>
              <p>证书由出师考核达标后生成，正式考核可由师父审核确认后发证。</p>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>序号</th>
                <th>徒弟</th>
                <th>班级/部门</th>
                <th>证书编号</th>
                <th>等级</th>
                <th>成绩</th>
                <th>签发时间</th>
                <th>核验</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((certificate, index) => (
                <tr key={certificate.id}>
                  <td>{index + 1}</td>
                  <td><strong>{certificate.user.username}</strong></td>
                  <td>{certificate.user.className ?? "-"}</td>
                  <td><code>{certificate.certificateNo}</code></td>
                  <td><span className={`badge ${certificate.finalScore >= 90 ? "green" : "blue"}`}>{certificate.level}</span></td>
                  <td><strong>{certificate.finalScore}分</strong></td>
                  <td>{certificate.issuedAt.toLocaleString("zh-CN")}</td>
                  <td>
                    <Link className="button secondary nowrap-button" href={`/certificate/verify?q=${encodeURIComponent(certificate.certificateNo)}`} target="_blank">
                      <BadgeCheck size={16} />
                      核验
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!certificates.length ? <p className="muted">当前还没有生成证书。徒弟通过出师考核后会自动进入这里。</p> : null}
        </div>
      </section>
    </>
  );
}
