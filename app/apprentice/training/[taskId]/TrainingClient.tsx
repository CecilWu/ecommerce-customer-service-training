"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, Bot, ExternalLink, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { ReportView } from "@/components/ReportView";
import type { TurnQualityResult } from "@/lib/service-quality";
import type { ChatMessage, ConversationScoreProgress, CustomerState, Product, ScoreReport, Task } from "@/lib/types";

type AIStatus = {
  usedModel: boolean;
  ruleDriven?: boolean;
  provider?: string;
  model?: string;
  error?: string;
};

function stateForDifficulty(task: Task): CustomerState {
  if (task.difficulty === "hard") return { emotion: 78, trust: 24, resolution: 8 };
  if (task.difficulty === "medium") return { emotion: 54, trust: 38, resolution: 14 };
  return { emotion: 34, trust: 52, resolution: 22 };
}

function makeMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

export function TrainingClient({
  task,
  product
}: {
  task: Task;
  product: Product;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [customerState, setCustomerState] = useState<CustomerState>(() => stateForDifficulty(task));
  const [scoreResult, setScoreResult] = useState<{ report: ScoreReport; reportId: string; sessionId: string } | null>(null);
  const [scorePendingReview, setScorePendingReview] = useState<{ reportId: string; sessionId: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [qualityWarning, setQualityWarning] = useState<TurnQualityResult | null>(null);
  const [qualityWarningCount, setQualityWarningCount] = useState(0);
  const [flaggedMessageIds, setFlaggedMessageIds] = useState<Set<string>>(() => new Set());
  const [scoreProgress, setScoreProgress] = useState<ConversationScoreProgress | null>(null);

  useEffect(() => {
    let active = true;

    async function startTraining() {
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/training/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id })
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || "训练会话创建失败");
        }
        const result = (await response.json()) as {
          sessionId: string;
          state: CustomerState;
          messages: ChatMessage[];
          ai?: AIStatus;
        };
        if (!active) return;
        setSessionId(result.sessionId);
        setCustomerState(result.state);
        setMessages(result.messages);
        setAiStatus(result.ai ?? null);
      } catch (startError) {
        if (active) setError(startError instanceof Error ? startError.message : "训练会话创建失败");
      } finally {
        if (active) setBusy(false);
      }
    }

    startTraining();
    return () => {
      active = false;
    };
  }, [task.id]);

  const apprenticeRounds = useMemo(() => messages.filter((message) => message.role === "apprentice").length, [messages]);
  const reachedLimit = apprenticeRounds >= task.roundLimit;

  async function sendMessage(content = input) {
    const trimmed = content.trim();
    if (!trimmed || busy || reachedLimit || !sessionId) return;

    const apprenticeMessage = makeMessage("apprentice", trimmed);
    setMessages((current) => [...current, apprenticeMessage]);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/training/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content: trimmed })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "AI客户回复失败");
      }
      const result = (await response.json()) as {
        messages: ChatMessage[];
        state: CustomerState;
        ai?: AIStatus;
        quality?: TurnQualityResult;
        progress?: ConversationScoreProgress;
      };
      setCustomerState(result.state);
      setAiStatus(result.ai ?? null);
      setScoreProgress(result.progress ?? null);
      if (result.quality?.warningTitle) {
        setQualityWarning(result.quality);
        setQualityWarningCount((current) => current + 1);
        const savedApprenticeId = result.messages.find((message) => message.role === "apprentice")?.id;
        if (savedApprenticeId) {
          setFlaggedMessageIds((current) => new Set([...current, savedApprenticeId]));
        }
      }
      setMessages((current) => {
        const withoutOptimistic = current.filter((message) => message.id !== apprenticeMessage.id);
        return [...withoutOptimistic, ...result.messages];
      });
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== apprenticeMessage.id));
      setInput(trimmed);
      setError(sendError instanceof Error ? sendError.message : "AI客户回复失败");
    } finally {
      setBusy(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendMessage();
  }

  async function submitForScore() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/training/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "评分失败");
      }
      const result = (await response.json()) as { report: ScoreReport; reportId: string; sessionId: string };
      if (task.reportVisibleMode === "mentor_review") {
        setScorePendingReview({ reportId: result.reportId, sessionId: result.sessionId });
      } else {
        setScoreResult(result);
        window.localStorage.setItem("latest-training-report", JSON.stringify(result.report));
      }
    } catch (scoreError) {
      setError(scoreError instanceof Error ? scoreError.message : "评分失败");
    } finally {
      setBusy(false);
    }
  }

  const quickReplies = [
    "非常理解您现在着急的心情，我先帮您核实订单和商品情况。",
    "麻烦您提供订单号、收货时间和问题照片，我会按售后规则为您申请处理。",
    "如果核实后符合退换货规则，我会优先帮您处理，并在24小时内反馈进度。"
  ];
  const taskTypeText = task.type === "exam" ? "正式出师考核" : task.type === "assessment" ? "阶段测评" : "日常训练";
  const difficultyText = task.difficulty === "hard" ? "困难" : task.difficulty === "medium" ? "中等" : "简单";
  const pressureText =
    task.difficulty === "hard"
      ? "客户处于高压投诉状态，可能质疑详情页、要求退款补偿，并用差评或平台投诉施压。"
      : task.difficulty === "medium"
        ? "客户明显不满，会追问处理方案、凭证要求和处理时效。"
        : "客户表达不满但较克制，重点考察基础接待和规则解释。";

  return (
    <div className="stack training-workspace">
      <div className="training-layout">
        <aside className="training-side">
          <div className="panel-head">
            <Link className="button secondary" href="/apprentice/tasks">
              <ArrowLeft size={17} />
              返回任务
            </Link>
          </div>
          <div className="panel-body stack compact-panel">
            <div>
              <span className={`badge ${task.difficulty === "hard" ? "red" : task.difficulty === "medium" ? "orange" : "green"}`}>{difficultyText}</span>
              <h1 style={{ fontSize: 24, margin: "12px 0 8px" }}>{task.title}</h1>
              <p className="muted">{taskTypeText}</p>
            </div>
            <div className="flat-card">
              <strong>任务描述</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {task.scenario}
              </p>
            </div>
            <div className="flat-card">
              <strong>客户情况</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {pressureText}
              </p>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {task.customerProfile || pressureText}
              </p>
            </div>
            <div className="flat-card task-order-summary">
              <strong>订单信息</strong>
              <dl>
                <div><dt>订单号</dt><dd>{task.orderInfo.orderNo || "未提供"}</dd></div>
                <div><dt>下单/签收</dt><dd>{task.orderInfo.placedAt || "未提供"}</dd></div>
                <div><dt>实付/数量</dt><dd>{task.orderInfo.amount || "-"} · {task.orderInfo.quantity || "-"}</dd></div>
                <div><dt>规格</dt><dd>{task.orderInfo.variant || "未提供"}</dd></div>
                <div><dt>物流状态</dt><dd>{task.orderInfo.logisticsStatus || "未提供"}</dd></div>
                <div><dt>现有凭证</dt><dd>{task.orderInfo.evidenceStatus || "未提供"}</dd></div>
              </dl>
            </div>
            <div className="flat-card">
              <strong>接待要求</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                先承接情绪，再核实订单、凭证和问题事实，最后给出合规边界内的处理路径与跟进时效。
              </p>
            </div>
            <div className="stack">
              <strong>能力目标</strong>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {task.objectives.map((objective) => (
                  <span className="badge blue" key={objective}>
                    {objective}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid two">
              <div className="flat-card">
                <span className="stat-label">轮次</span>
                <span className="stat-value" style={{ fontSize: 24 }}>
                  {apprenticeRounds}/{task.roundLimit}
                </span>
              </div>
              <div className="flat-card">
                <span className="stat-label">时限</span>
                <span className="stat-value" style={{ fontSize: 24 }}>
                  {task.timeLimit}分
                </span>
              </div>
            </div>
          </div>
        </aside>

        <section className="chat-panel">
          <div className="panel-head spread">
            <div className="row">
              <Bot size={22} />
              <strong>AI真实客户接待</strong>
            </div>
            <button className="button success" type="button" onClick={submitForScore} disabled={busy || messages.length < 2}>
              <BarChart3 size={17} />
              提交评分
            </button>
          </div>

          <div className="chat-log">
            {error ? <div className="message customer">系统提示：{error}</div> : null}
            {messages.map((message) => {
              const turnScore = scoreProgress?.turnScores.find((item) => item.apprenticeMessageId === message.id);
              return (
                <div
                  className={`message ${message.role === "customer" ? "customer" : "apprentice"}${flaggedMessageIds.has(message.id) ? " message-risk" : ""}`}
                  key={message.id}
                >
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    {message.role === "customer" ? <UserRound size={18} /> : <ShieldCheck size={18} />}
                    <span>{message.content}</span>
                  </div>
                  {turnScore ? (
                    <div className="turn-score-feedback">
                      <div className="spread">
                        <strong>第{turnScore.turn}轮 · {turnScore.stage}</strong>
                        <span className={`badge ${turnScore.score >= 75 ? "green" : turnScore.score >= 60 ? "orange" : "red"}`}>
                          本轮 {turnScore.score} 分
                        </span>
                      </div>
                      <p>{turnScore.issues[0]}</p>
                      <p className="turn-score-suggestion"><strong>改进：</strong>{turnScore.suggestion}</p>
                    </div>
                  ) : null}
                  {flaggedMessageIds.has(message.id) ? (
                    <div className="message-risk-label">
                      <AlertTriangle size={14} /> 已记入实时质检
                    </div>
                  ) : null}
                </div>
              );
            })}
            {busy ? <div className="message customer">{sessionId ? "正在生成回复..." : "正在创建训练会话..."}</div> : null}
          </div>

          <div className="chat-input">
            <textarea
              className="textarea"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={reachedLimit ? "已达到任务轮次上限，请提交评分" : "输入客服回复"}
              disabled={busy || reachedLimit || !sessionId}
              style={{ minHeight: 64 }}
            />
            <button className="button primary" type="button" onClick={() => sendMessage()} disabled={busy || reachedLimit || !sessionId}>
              <Send size={17} />
              发送
            </button>
          </div>
        </section>

        <aside className="training-assist">
          <div className="panel-head">
            <strong>岗位辅助面板</strong>
          </div>
          <div className="panel-body stack compact-panel">
            <div className="flat-card">
              <div className="spread">
                <span>AI客户状态</span>
                <span className={`badge ${aiStatus?.usedModel ? "green" : aiStatus?.ruleDriven ? "red" : "orange"}`}>
                  {aiStatus?.usedModel ? "大模型生成" : aiStatus?.ruleDriven ? "质检规则接管" : "本地应急"}
                </span>
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {aiStatus?.usedModel
                  ? `${aiStatus.provider ?? "AI"} · ${aiStatus.model ?? "已连接"}`
                  : aiStatus?.error || "正在连接AI模型..."}
              </p>
            </div>
            <div className={`flat-card live-quality-card${qualityWarningCount ? " has-warning" : ""}`}>
              <div className="spread">
                <span>实时质检</span>
                <span className={`badge ${qualityWarningCount ? "red" : "green"}`}>
                  {qualityWarningCount ? `${qualityWarningCount} 次提醒` : "暂未触发"}
                </span>
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                系统逐轮检测辱骂、威胁、推诿、机械复读和低信息回复；触发记录会进入最终评分。
              </p>
            </div>
            <div className="flat-card realtime-score-card">
              <div className="spread">
                <span>当前加权成绩</span>
                <strong>{scoreProgress ? `${scoreProgress.currentScore}分` : "待计算"}</strong>
              </div>
              {scoreProgress ? (
                <>
                  <div className="score-bar realtime-total-bar">
                    <span style={{ width: `${scoreProgress.currentScore}%` }} />
                  </div>
                  <div className="realtime-score-meta">
                    <span>{scoreProgress.completedTurns}轮已统计</span>
                    <span>当前封顶 {scoreProgress.scoreCap}</span>
                    <span>质量扣分 -{scoreProgress.penaltyTotal}</span>
                  </div>
                  <div className="realtime-dimensions">
                    {scoreProgress.dimensions.map((dimension) => (
                      <div key={dimension.name}>
                        <span>{dimension.name.replace("力", "")}</span>
                        <strong>{dimension.score}/{dimension.maxScore}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="muted realtime-score-note">阶段数据会随每一轮重新计算；全部聊天记录都会进入最终加权成绩。</p>
                </>
              ) : (
                <p className="muted" style={{ margin: "8px 0 0" }}>发送第一条客服回复后开始逐轮计算。</p>
              )}
            </div>
            <div className="flat-card">
              <div className="spread">
                <span>客户情绪</span>
                <strong>{customerState.emotion}</strong>
              </div>
              <div className="score-bar">
                <span style={{ width: `${customerState.emotion}%`, background: "var(--orange)" }} />
              </div>
            </div>
            <div className="flat-card">
              <div className="spread">
                <span>信任程度</span>
                <strong>{customerState.trust}</strong>
              </div>
              <div className="score-bar">
                <span style={{ width: `${customerState.trust}%`, background: "var(--green)" }} />
              </div>
            </div>
            <div className="flat-card">
              <div className="spread">
                <span>解决进度</span>
                <strong>{customerState.resolution}</strong>
              </div>
              <div className="score-bar">
                <span style={{ width: `${customerState.resolution}%` }} />
              </div>
            </div>

            {task.showHints ? (
              <div className="stack">
                <strong>回复素材</strong>
                {quickReplies.map((reply) => (
                  <button className="button secondary" type="button" key={reply} onClick={() => sendMessage(reply)} disabled={busy || reachedLimit}>
                    {reply}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flat-card">
                <strong>考试模式</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  当前任务不显示辅助话术，报告需师父审核。
                </p>
              </div>
            )}

            <div className="flat-card">
              <strong>知识参考</strong>
              <ul>
                {product.policy.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {qualityWarning ? (
        <div className="quality-warning-backdrop" role="alertdialog" aria-modal="true" aria-label={qualityWarning.warningTitle}>
          <section className={`quality-warning-modal ${qualityWarning.moderation.severity === "critical" ? "critical" : "warning"}`}>
            <div className="quality-warning-icon" aria-hidden="true">
              <AlertTriangle size={34} />
            </div>
            <div>
              <span className="eyebrow">实时岗位质检</span>
              <h2>{qualityWarning.warningTitle}</h2>
              <p className="lead">{qualityWarning.warningMessage}</p>
            </div>

            {qualityWarning.moderation.triggered ? (
              <div className="quality-warning-details">
                {qualityWarning.moderation.violations.map((violation) => (
                  <div className="flat-card" key={violation.code}>
                    <div className="spread">
                      <strong>{violation.category}</strong>
                      <span className="badge red">{violation.matchedHint}</span>
                    </div>
                    <p>{violation.reason}</p>
                    <p style={{ marginBottom: 0 }}><strong>建议改为：</strong>{violation.replacement}</p>
                  </div>
                ))}
                <div className="quality-penalty-grid">
                  <div><span>规则扣分</span><strong>-{qualityWarning.moderation.penalty}</strong></div>
                  <div><span>本次总分最高</span><strong>{qualityWarning.moderation.scoreCap}</strong></div>
                </div>
              </div>
            ) : (
              <div className="flat-card quality-repeat-detail">
                <strong>{qualityWarning.exactRepeat ? "完全重复" : qualityWarning.nearRepeat ? "高度相似" : "信息不足"}</strong>
                {qualityWarning.repeatedRound ? <p>与第 {qualityWarning.repeatedRound} 轮回复相似度 {Math.round(qualityWarning.similarity * 100)}%。</p> : null}
                <p style={{ marginBottom: 0 }}>本轮预计扣减 {qualityWarning.penalty} 分；相同能力点不会再次获得分数。</p>
              </div>
            )}

            <button className="button primary quality-warning-confirm" type="button" onClick={() => setQualityWarning(null)}>
              我已知悉，继续训练
            </button>
          </section>
        </div>
      ) : null}

      {scoreResult ? (
        <div className="score-modal-backdrop" role="dialog" aria-modal="true" aria-label="本次训练评分结果">
          <section className="score-modal">
            <div className="score-modal-head">
              <div>
                <span className="eyebrow">评分结果</span>
                <h2>本次训练诊断报告</h2>
              </div>
              <div className="row">
                <Link className="button secondary" href={`/apprentice/reports/${scoreResult.reportId}`}>
                  <ExternalLink size={17} />
                  查看完整报告
                </Link>
                <button className="button secondary" type="button" onClick={() => setScoreResult(null)} aria-label="关闭评分结果">
                  <X size={17} />
                  关闭
                </button>
              </div>
            </div>
            <div className="score-modal-body">
              <ReportView report={scoreResult.report} />
            </div>
          </section>
        </div>
      ) : null}

      {scorePendingReview ? (
        <div className="score-modal-backdrop" role="dialog" aria-modal="true" aria-label="训练提交成功">
          <section className="score-modal">
            <div className="score-modal-head">
              <div>
                <span className="eyebrow">提交成功</span>
                <h2>等待师父审核</h2>
              </div>
              <button className="button secondary" type="button" onClick={() => setScorePendingReview(null)} aria-label="关闭提交提示">
                <X size={17} />
                关闭
              </button>
            </div>
            <div className="score-modal-body">
              <section className="card">
                <div className="section-title">
                  <ShieldCheck size={24} />
                  <div>
                    <h2>本次训练已形成诊断报告</h2>
                    <p>当前任务设置为“师父审核后可见”。师父复核后，你可以在训练台的诊断报告中查看分数和改进建议。</p>
                  </div>
                </div>
                <div className="row">
                  <Link className="button primary" href="/apprentice">
                    返回训练台
                  </Link>
                  <Link className="button secondary" href="/apprentice/tasks">
                    查看任务
                  </Link>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
