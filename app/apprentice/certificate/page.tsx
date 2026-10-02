import { Medal } from "lucide-react";
import { CertificateExportButton } from "@/components/CertificateExportButton";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apprenticeVisibleReportWhere } from "@/lib/report-access";

export default async function CertificatePage() {
  const user = await requireUser(["APPRENTICE"]);
  const certificate = await prisma.certificate.findFirst({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" }
  });
  const finalReport = await prisma.scoreReport.findFirst({
    where: {
      AND: [apprenticeVisibleReportWhere(user.id), { session: { task: { type: "EXAM" } } }]
    },
    include: {
      session: {
        include: {
          task: {
            include: {
              createdBy: {
                select: {
                  username: true,
                  signatureImagePath: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const fallbackMentor = await prisma.user.findFirst({
    where: {
      role: "MASTER",
      signatureImagePath: { not: null }
    },
    select: {
      username: true,
      signatureImagePath: true
    }
  });
  const displayScore = finalReport?.totalScore ?? certificate?.finalScore ?? 86;
  const displayLevel = finalReport?.level ?? certificate?.level ?? "良好";
  const mentorSignature = finalReport?.session.task.createdBy?.signatureImagePath ?? fallbackMentor?.signatureImagePath;
  const mentorUsername = finalReport?.session.task.createdBy?.username ?? fallbackMentor?.username ?? "电商客服实训指导教师";

  return (
    <>
      <section className="container stack">
        <div className="spread">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Medal size={26} />
            <div>
              <h1 style={{ margin: 0 }}>出师证书</h1>
              <p>样式预览，正式版可绑定徒弟用户名、班级、考核编号和师父签章。</p>
            </div>
          </div>
          <CertificateExportButton certificateNo={certificate?.certificateNo ?? "ECS-2026-PREVIEW"} />
        </div>

        <section className="certificate" id="apprentice-certificate">
          <img className="certificate-header-ornament" src="/images/certificate-header-ornament-v2.png" alt="证书顶部装饰纹样" />
          <span className="badge blue certificate-type-badge">电商客服岗位实训</span>
          <h1>出师证书</h1>
          <p className="lead" style={{ margin: "0 auto", maxWidth: 720 }}>
            兹证明
          </p>
          <div className="certificate-name">{user.username}</div>
          <p className="lead" style={{ margin: "0 auto", maxWidth: 760 }}>
            已完成电商客服AI极端客户实训课程，经过日常训练、阶段测评与期末出师考核，具备基础岗位接待、售后处理、投诉应对与风险合规意识。
          </p>
          <div className="grid three" style={{ marginTop: 30, textAlign: "left" }}>
            <div className="flat-card">
              <span className="stat-label">综合成绩</span>
              <span className="stat-value">{displayScore}分</span>
            </div>
            <div className="flat-card">
              <span className="stat-label">评定等级</span>
              <span className="stat-value">{displayLevel}</span>
            </div>
            <div className="flat-card">
              <span className="stat-label">证书编号</span>
              <span className="stat-value" style={{ fontSize: 22 }}>
                {certificate?.certificateNo ?? "ECS-2026-PREVIEW"}
              </span>
            </div>
          </div>
          <div className="spread" style={{ marginTop: 34 }}>
            <div className="certificate-signature-block">
              <strong>师父签章</strong>
              <div className="certificate-signature">
                {mentorSignature ? (
                  <img src={mentorSignature} alt={`${mentorUsername}签章`} />
                ) : (
                  <span>签章图片占位</span>
                )}
              </div>
              <p className="muted" style={{ margin: "6px 0 0" }}>{mentorUsername}</p>
            </div>
            <div>
              <strong>发证日期</strong>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                {(certificate?.issuedAt ?? finalReport?.createdAt ?? new Date()).toLocaleDateString("zh-CN")}
              </p>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
