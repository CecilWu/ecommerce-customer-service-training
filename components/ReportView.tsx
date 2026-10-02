import { AlertTriangle, CheckCircle2, MessageSquareText, Target } from "lucide-react";
import type { ScoreReport } from "@/lib/types";
import { ScoreBar } from "./ScoreBar";

export function ReportView({ report }: { report: ScoreReport }) {
  const badgeColor = report.totalScore >= 80 ? "green" : report.totalScore >= 70 ? "orange" : "red";

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="card">
        <div className="spread">
          <div>
            <div className={`badge ${badgeColor} report-level-badge`}>{report.level}</div>
            <h1 style={{ fontSize: 46, margin: "14px 0 6px" }}>{report.totalScore}分</h1>
            <p className="muted" style={{ margin: 0 }}>
              原始分 {report.rawScore} · {report.passStatus}
            </p>
          </div>
          <div style={{ maxWidth: 620 }}>
            <h2 style={{ marginBottom: 8 }}>本次总评</h2>
            <p className="lead" style={{ fontSize: 16, margin: 0 }}>
              {report.summary}
            </p>
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <div className="section-title">
            <Target size={22} />
            <div>
              <h2>六维分项得分</h2>
              <p>按照“岗境证据链-六维四阶”模型评价</p>
            </div>
          </div>
          <div className="stack">
            {report.dimensions.map((dimension) => (
              <ScoreBar key={dimension.name} label={dimension.name} score={dimension.score} maxScore={dimension.maxScore} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <MessageSquareText size={22} />
            <div>
              <h2>师父式诊断</h2>
              <p>把扣分点转化为下一次可练习的动作</p>
            </div>
          </div>
          <div className="grid two">
            <div className="flat-card">
              <div className="row">
                <CheckCircle2 color="var(--green)" size={20} />
                <strong>做得好的地方</strong>
              </div>
              <ul>
                {report.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="flat-card">
              <div className="row">
                <AlertTriangle color="var(--orange)" size={20} />
                <strong>需要改进</strong>
              </div>
              <ul>
                {report.weaknesses.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {report.turnScores?.length ? (
        <section className="card">
          <div className="section-title">
            <MessageSquareText size={22} />
            <div>
              <h2>逐轮评分轨迹</h2>
              <p>每一轮都进入最终权重计算，弱回复不会被后面的模板话术覆盖</p>
            </div>
          </div>
          {report.scoringMethod ? (
            <div className="flat-card report-score-formula">
              <strong>计算口径</strong>
              <p>{report.scoringMethod.formula}</p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <span className="badge blue">逐轮表现 {report.scoringMethod.turnContributionPercent}%</span>
                <span className="badge blue">全程覆盖 {report.scoringMethod.coverageContributionPercent}%</span>
                <span className="badge orange">全局扣分 {report.scoringMethod.penaltyTotal}</span>
                <span className="badge orange">最终封顶 {report.scoringMethod.scoreCap}</span>
              </div>
            </div>
          ) : null}
          <div className="turn-score-timeline">
            {report.turnScores.map((turn) => (
              <div className="flat-card" key={`${turn.turn}-${turn.apprenticeMessageId}`}>
                <div className="spread">
                  <strong>第{turn.turn}轮 · {turn.stage}</strong>
                  <span className={`badge ${turn.score >= 75 ? "green" : turn.score >= 60 ? "orange" : "red"}`}>
                    {turn.score}分
                  </span>
                </div>
                <p>{turn.issues[0]}</p>
                <p className="muted" style={{ marginBottom: 0 }}><strong>建议：</strong>{turn.suggestion}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="section-title">
          <AlertTriangle size={22} />
          <div>
            <h2>风险话术提醒</h2>
            <p>真实岗位中可能引发投诉、赔付或合规问题的表达</p>
          </div>
        </div>
        {report.riskItems.length ? (
          <div className="stack">
            {report.riskItems.map((item) => (
              <div className="flat-card" key={`${item.type}-${item.quote}`}>
                <div className="spread">
                  <strong>{item.type}</strong>
                  <span className="badge orange">{item.riskLevel}</span>
                </div>
                <p style={{ marginTop: 12 }}>
                  <strong>原话：</strong>
                  {item.quote}
                </p>
                <p>
                  <strong>原因：</strong>
                  {item.reason}
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong>建议：</strong>
                  {item.suggestedReplacement}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">未发现明显高风险话术。</p>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <CheckCircle2 size={22} />
          <div>
            <h2>推荐改进话术</h2>
            <p>建议理解结构，不建议机械背诵</p>
          </div>
        </div>
        <p className="lead" style={{ fontSize: 16, marginBottom: 16 }}>
          {report.recommendedScript}
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {report.nextPractice.map((item) => (
            <span className="badge blue" key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
