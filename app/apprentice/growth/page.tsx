import { BookOpenCheck, TrendingUp } from "lucide-react";
import { GrowthRadar } from "@/components/GrowthRadar";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aggregateRadarDimensions, averageScore, parseScoreReport } from "@/lib/growth";
import { apprenticeVisibleReportWhere } from "@/lib/report-access";

export default async function ApprenticeGrowthPage() {
  const user = await requireUser(["APPRENTICE"]);
  const reports = await prisma.scoreReport.findMany({
    where: apprenticeVisibleReportWhere(user.id),
    include: {
      session: {
        include: {
          task: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const radar = aggregateRadarDimensions(reports);
  const avg = averageScore(reports);
  const strongest = radar.slice().sort((a, b) => b.percent - a.percent)[0];
  const weakest = radar.slice().sort((a, b) => a.percent - b.percent)[0];
  const bestScore = reports.length ? Math.max(...reports.map((report) => report.totalScore)) : null;
  const passCount = reports.filter((report) => report.totalScore >= 70).length;
  const scoreRange = reports.length > 1 ? Math.max(...reports.map((report) => report.totalScore)) - Math.min(...reports.map((report) => report.totalScore)) : null;
  const latest = reports[0];

  return (
    <>
      <section className="container stack">
        <div className="section-title">
          <BookOpenCheck size={26} />
          <div>
            <h1 style={{ margin: 0 }}>成长画像</h1>
            <p>系统汇总历次诊断报告，形成六维客服能力雷达和待补强方向。</p>
          </div>
        </div>

        <div className="grid growth-overview-grid">
          <section className="card growth-radar-section">
            <div className="section-title">
              <TrendingUp size={22} />
              <div>
                <h2>成长雷达图</h2>
                <p>按六维评价指标汇总平均表现。</p>
              </div>
            </div>
            <GrowthRadar dimensions={radar} />
          </section>

          <section className="card">
            <h2>成长摘要</h2>
            <div className="grid two growth-summary-stats">
              <div className="flat-card">
                <span className="stat-label">报告数量</span>
                <span className="stat-value">{reports.length}</span>
              </div>
              <div className="flat-card">
                <span className="stat-label">平均得分</span>
                <span className="stat-value">{avg ?? "暂无"}</span>
              </div>
              <div className="flat-card">
                <span className="stat-label">最佳得分</span>
                <span className="stat-value">{bestScore ?? "暂无"}</span>
              </div>
              <div className="flat-card">
                <span className="stat-label">达标率</span>
                <span className="stat-value">{reports.length ? `${Math.round((passCount / reports.length) * 100)}%` : "暂无"}</span>
              </div>
            </div>
            <div className="growth-insight-grid">
              <div className="flat-card">
                <span className="stat-label">优势能力</span>
                <strong>{strongest ? `${strongest.shortName} ${strongest.percent}%` : "完成评分后生成"}</strong>
                <p className="muted">当前六维能力中表现最稳定的方向。</p>
              </div>
              <div className="flat-card">
                <span className="stat-label">优先诊改</span>
                <strong>{weakest ? `${weakest.shortName} ${weakest.percent}%` : "完成评分后生成"}</strong>
                <p className="muted">建议在下一次训练中优先设置对应能力目标。</p>
              </div>
              <div className="flat-card">
                <span className="stat-label">得分稳定性</span>
                <strong>{scoreRange === null ? "待更多报告" : scoreRange <= 8 ? "表现稳定" : "存在波动"}</strong>
                <p className="muted">{scoreRange === null ? "至少完成两次评分后可判断。" : `当前最高与最低得分相差 ${scoreRange} 分。`}</p>
              </div>
              <div className="flat-card">
                <span className="stat-label">最近评估</span>
                <strong>{latest ? `${latest.totalScore}分 · ${latest.level}` : "暂无"}</strong>
                <p className="muted">{latest ? latest.session.task.title : "完成训练后会显示最近任务。"}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="card">
          <div className="section-title">
            <TrendingUp size={22} />
            <div>
              <h2>历次表现</h2>
              <p>每次报告都会沉淀到成长画像中。</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>总分</th>
                  <th>等级</th>
                  <th>最低维度</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((record) => {
                  const report = parseScoreReport(record.reportJson);
                  const weakest = report?.dimensions.slice().sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0];
                  return (
                    <tr key={record.id}>
                      <td>{record.session.task.title}</td>
                      <td>{record.totalScore}</td>
                      <td>{record.level}</td>
                      <td>{weakest ? `${weakest.name} ${weakest.score}/${weakest.maxScore}` : "-"}</td>
                      <td>{record.createdAt.toLocaleString("zh-CN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!reports.length ? <p className="muted">完成训练评分后，这里会显示成长趋势。</p> : null}
          </div>
        </section>
      </section>
    </>
  );
}
