import { analyzeConversationQuality, analyzeTurnQuality, normalizeServiceText } from "./service-quality";
import type {
  ChatMessage,
  ConversationScoreProgress,
  DimensionScore,
  RiskItem,
  ScoreReport,
  TurnDimensionScore,
  TurnScore
} from "./types";

const SIGNALS = {
  empathy: ["理解", "能理解", "很抱歉", "抱歉", "不好意思", "影响体验", "确实着急", "给您添麻烦"],
  order: ["订单", "单号", "订单号"],
  evidence: ["照片", "视频", "凭证", "吊牌", "截图", "外包装", "实拍"],
  receiptTime: ["收货", "签收", "购买时间", "下单时间"],
  expectation: ["您的诉求", "您希望", "期望处理", "想要退款", "想要换货", "具体诉求"],
  issue: ["问题", "情况", "诉求", "色差", "颜色", "尺码", "故障", "破损", "少件", "无声", "质量", "物流", "虚假宣传"],
  solution: ["退货", "换货", "退款", "维修", "补发", "申请售后", "发起售后", "平台介入", "处理方案"],
  timeline: ["小时", "工作日", "今天", "明天", "时效", "反馈时间", "最晚", "预计"],
  close: ["是否接受", "可以吗", "能否接受", "是否认可", "还有其他", "确认一下", "我再为您确认"],
  rule: ["规则", "售后政策", "符合", "平台规定", "退换条件", "运费责任", "审核标准"],
  conditional: ["核实后", "如果符合", "若符合", "以审核结果", "根据凭证", "确认后", "审核通过后"],
  customerAction: ["请提供", "麻烦您提供", "请上传", "您可以提交", "请您拍摄", "需要您"],
  followUp: ["持续跟进", "为您跟进", "反馈进度", "工单", "登记", "回访", "后续联系", "处理节点"],
  ownership: ["我来帮您", "我先帮您", "我会为您", "这边为您", "我帮您核实", "我继续跟进"]
} as const;

const CONCERN_GROUPS = [
  ["色差", "颜色", "浅灰", "深灰", "页面展示", "虚假宣传"],
  ["退款", "退货", "换货"],
  ["赔偿", "补偿", "赔付"],
  ["差评", "投诉", "平台介入"],
  ["照片", "实拍", "凭证", "吊牌", "外包装"],
  ["订单", "单号"],
  ["物流", "签收", "收货"],
  ["质量", "破损", "故障", "少件"]
] as const;

const DIMENSIONS = [
  { key: "insight", name: "客户问题洞察力", maxScore: 15 },
  { key: "empathy", name: "情绪调节与信任修复力", maxScore: 15 },
  { key: "rule", name: "产品规则与证据应用力", maxScore: 15 },
  { key: "solution", name: "服务恢复方案设计力", maxScore: 20 },
  { key: "risk", name: "流程规范与风险治理力", maxScore: 20 },
  { key: "expression", name: "职业表达与成长迁移力", maxScore: 15 }
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]["key"];
type Stage = TurnScore["stage"];

// 不同阶段使用不同的100分量表，首轮重安抚，中段重核实，后段重方案和闭环。
const STAGE_RUBRIC: Record<Stage, Record<DimensionKey, number>> = {
  接待安抚: { insight: 25, empathy: 30, rule: 10, solution: 10, risk: 15, expression: 10 },
  事实核实: { insight: 30, empathy: 15, rule: 20, solution: 10, risk: 15, expression: 10 },
  方案推进: { insight: 15, empathy: 10, rule: 20, solution: 30, risk: 15, expression: 10 },
  闭环确认: { insight: 10, empathy: 10, rule: 15, solution: 30, risk: 20, expression: 15 }
};

const TURN_WEIGHT: Record<Stage, number> = {
  接待安抚: 1.15,
  事实核实: 1,
  方案推进: 1.25,
  闭环确认: 1.15
};

function hasAny(text: string, words: readonly string[]) {
  return words.some((word) => text.includes(word));
}

function hasQuestion(text: string) {
  return /[?？]/u.test(text) || hasAny(text, ["请问", "麻烦确认", "能否提供", "是否", "方便提供"]);
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function quote(value: string, maxLength = 80) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}

function ratioOf(values: boolean[]) {
  return values.length ? values.filter(Boolean).length / values.length : 0;
}

function concernMatch(customer: string, apprentice: string) {
  const mentioned = CONCERN_GROUPS.filter((group) => hasAny(customer, group));
  if (!mentioned.length) return hasAny(apprentice, SIGNALS.issue) ? 1 : 0.5;
  return mentioned.filter((group) => hasAny(apprentice, group)).length / mentioned.length;
}

function detectsRedundantQuestion(customerHistory: string, reply: string) {
  const asksOrder = /(?:请|麻烦|需要).{0,8}(?:提供|告知|发送).{0,5}(?:订单|单号)/u.test(reply);
  const asksEvidence = /(?:请|麻烦|需要).{0,8}(?:提供|上传|发送|拍).{0,5}(?:照片|视频|凭证|实拍|吊牌)/u.test(reply);
  const orderAlreadyProvided = /(?:订单|单号)[^\n，。；]{0,18}[a-z0-9]{5,}/iu.test(customerHistory);
  const evidenceAlreadyProvided = /(?:已经|都|已).{0,8}(?:拍|上传|提供)|(?:照片|视频|实拍).{0,8}(?:有|拍了|提供了)/u.test(customerHistory);
  return {
    order: asksOrder && orderAlreadyProvided,
    evidence: asksEvidence && evidenceAlreadyProvided
  };
}

function stageForTurn(turn: number, reply: string): Stage {
  if (turn === 1) return "接待安抚";
  const hasSolution = hasAny(reply, SIGNALS.solution);
  if (hasSolution && hasAny(reply, SIGNALS.close)) return "闭环确认";
  if (hasSolution || hasAny(reply, SIGNALS.timeline) || hasAny(reply, SIGNALS.followUp)) return "方案推进";
  return "事实核实";
}

function turnDimensionScores(ratios: Record<DimensionKey, number>): TurnDimensionScore[] {
  return DIMENSIONS.map((dimension) => ({
    ...dimension,
    score: Math.round(clamp(ratios[dimension.key], 0, 1) * dimension.maxScore)
  }));
}

function evaluateTurn({ message, turn, customerMessage, customerHistory, previousReplies }: {
  message: ChatMessage;
  turn: number;
  customerMessage: ChatMessage | null;
  customerHistory: string;
  previousReplies: string[];
}): TurnScore {
  const reply = message.content.trim();
  const customer = customerMessage?.content ?? "";
  const quality = analyzeTurnQuality(reply, previousReplies);
  const normalizedLength = normalizeServiceText(reply).length;
  const empathized = hasAny(reply, SIGNALS.empathy);
  const apologized = hasAny(reply, ["抱歉", "对不起", "不好意思", "给您添麻烦"]);
  const ownership = hasAny(reply, SIGNALS.ownership);
  const acknowledgedIssue = hasAny(reply, SIGNALS.issue) || concernMatch(customer, reply) > 0;
  const question = hasQuestion(reply);
  const rule = hasAny(reply, SIGNALS.rule);
  const conditional = hasAny(reply, SIGNALS.conditional);
  const evidence = hasAny(reply, SIGNALS.evidence);
  const solution = hasAny(reply, SIGNALS.solution);
  const customerAction = hasAny(reply, SIGNALS.customerAction);
  const timeline = hasAny(reply, SIGNALS.timeline);
  const followUp = hasAny(reply, SIGNALS.followUp);
  const close = hasAny(reply, SIGNALS.close);
  const riskyPromise = hasAny(reply, ["肯定给您", "一定退款", "保证退款", "保证赔偿", "百分百", "绝对可以"]);
  const offPlatform = hasAny(reply, ["删差评", "撤投诉", "私下处理", "加微信", "微信转账", "支付宝转账"]);
  const blame = hasAny(reply, ["都是你自己", "是你自己的问题", "你自己造成", "跟我们没关系", "自己看", "没办法", "谁让你"]);
  const redundant = detectsRedundantQuestion(customerHistory, reply);
  const redundantQuestion = redundant.order || redundant.evidence;
  const matchedConcernRatio = concernMatch(customer, reply);

  let insightRatio = 0.08 + matchedConcernRatio * 0.38 + (acknowledgedIssue ? 0.14 : 0) +
    (question && !redundantQuestion ? 0.24 : 0) +
    (evidence || hasAny(reply, SIGNALS.order) || hasAny(reply, SIGNALS.receiptTime) ? 0.16 : 0);
  if (redundantQuestion) insightRatio -= 0.18;
  let empathyRatio = 0.08 + (empathized ? 0.38 : 0) + (apologized ? 0.2 : 0) +
    (ownership ? 0.26 : 0) + (/您|请/u.test(reply) ? 0.08 : 0);
  const ruleRatio = 0.08 + (rule ? 0.34 : 0) + (conditional ? 0.3 : 0) +
    (evidence ? 0.16 : 0) + (!riskyPromise && !offPlatform ? 0.12 : 0);
  const solutionRatio = 0.05 + (solution ? 0.3 : 0) + (customerAction ? 0.2 : 0) +
    (timeline ? 0.2 : 0) + (followUp ? 0.15 : 0) + (close ? 0.1 : 0);

  let riskRatio = 1;
  if (quality.moderation.severity === "critical") riskRatio -= 0.95;
  else if (quality.moderation.severity === "serious") riskRatio -= 0.65;
  if (riskyPromise) riskRatio -= 0.3;
  if (offPlatform) riskRatio -= 0.75;
  if (blame) riskRatio -= 0.5;
  if (quality.exactRepeat) riskRatio -= 0.35;
  else if (quality.nearRepeat) riskRatio -= 0.25;
  if (quality.lowInformation) riskRatio -= 0.15;

  let expressionRatio = 0.08 + (normalizedLength >= 12 ? 0.22 : normalizedLength >= 7 ? 0.1 : 0) +
    (normalizedLength <= 220 ? 0.1 : 0) +
    (/[，；：。]|第一|首先|然后|接下来/u.test(reply) ? 0.12 : 0) +
    (customerAction || timeline || followUp ? 0.23 : 0) +
    (!quality.exactRepeat && !quality.nearRepeat ? 0.25 : 0);
  if (quality.lowInformation) expressionRatio -= 0.35;
  if (redundantQuestion) expressionRatio -= 0.12;
  if (quality.moderation.triggered || blame) empathyRatio *= 0.15;

  const ratios: Record<DimensionKey, number> = {
    insight: clamp(insightRatio, 0, 1), empathy: clamp(empathyRatio, 0, 1),
    rule: clamp(ruleRatio, 0, 1), solution: clamp(solutionRatio, 0, 1),
    risk: clamp(riskRatio, 0, 1), expression: clamp(expressionRatio, 0, 1)
  };
  const stage = stageForTurn(turn, reply);
  const rubric = STAGE_RUBRIC[stage];
  const rawScore = Math.round((Object.keys(rubric) as DimensionKey[])
    .reduce((sum, key) => sum + ratios[key] * rubric[key], 0));
  const penalty = quality.penalty + (redundantQuestion ? 5 : 0);
  let scoreCap = quality.moderation.scoreCap;
  if (quality.exactRepeat) scoreCap = Math.min(scoreCap, 45);
  else if (quality.nearRepeat) scoreCap = Math.min(scoreCap, 60);
  if (quality.lowInformation) scoreCap = Math.min(scoreCap, 55);
  const score = Math.round(Math.min(scoreCap, Math.max(0, rawScore - penalty)));

  const strengths = [
    matchedConcernRatio >= 0.5 ? "回应了客户当前核心诉求" : "",
    empathized && ownership ? "完成情绪承接并主动担责" : "",
    rule && conditional ? "规则说明带有审核边界" : "",
    solution && timeline ? "方案包含明确处理时效" : "",
    followUp && close ? "具备跟进和闭环意识" : ""
  ].filter(Boolean);
  const issues = [
    quality.moderation.triggered ? quality.moderation.warningMessage : "",
    quality.exactRepeat || quality.nearRepeat ? "与前文高度重复，没有回应本轮新增问题" : "",
    quality.lowInformation ? "回复信息量过低，未形成有效推进" : "",
    redundant.order ? "客户已经给出订单信息，不应再次索要" : "",
    redundant.evidence ? "客户已经说明凭证情况，应先确认已收到再指出缺失项" : "",
    matchedConcernRatio < 0.34 ? "没有直接回应客户本轮最关心的问题" : "",
    !empathized && stage === "接待安抚" ? "首轮缺少准确的情绪承接" : "",
    riskyPromise ? "出现未经审核的绝对承诺" : "",
    !timeline && (stage === "方案推进" || stage === "闭环确认") ? "处理方案缺少反馈时效" : "",
    !close && stage === "闭环确认" ? "没有确认客户是否接受方案" : ""
  ].filter(Boolean);

  let suggestion = "先回应客户刚提出的新问题，再说明下一步动作和反馈节点。";
  if (quality.moderation.triggered) suggestion = quality.moderation.violations[0]?.replacement ?? suggestion;
  else if (quality.exactRepeat || quality.nearRepeat) suggestion = "不要复制上一轮话术；先回答客户新追问，再补充一个新的处理动作。";
  else if (redundantQuestion) suggestion = "先确认客户已提供的信息，只追问仍然缺失的订单或凭证要素。";
  else if (stage === "接待安抚" && !empathized) suggestion = "先复述客户的不满和争议点，再说明由你继续核实。";
  else if (!timeline && solution) suggestion = "在方案后补充预计反馈时间、跟进责任和结果确认方式。";

  return {
    turn, apprenticeMessageId: message.id, customerMessageId: customerMessage?.id ?? null,
    stage, weight: TURN_WEIGHT[stage], rawScore, penalty, scoreCap, score,
    dimensions: turnDimensionScores(ratios),
    strengths: strengths.length ? strengths : ["完成了本轮基础回应"],
    issues: issues.length ? issues : ["本轮未发现明显硬性风险"], suggestion
  };
}

function collectTurnScores(messages: ChatMessage[]) {
  const turnScores: TurnScore[] = [];
  const previousReplies: string[] = [];
  const customerMessages: ChatMessage[] = [];
  let latestCustomer: ChatMessage | null = null;
  for (const message of messages) {
    if (message.role === "customer") {
      latestCustomer = message;
      customerMessages.push(message);
    } else if (message.role === "apprentice") {
      turnScores.push(evaluateTurn({
        message, turn: turnScores.length + 1, customerMessage: latestCustomer,
        customerHistory: customerMessages.map((item) => item.content).join("\n"), previousReplies
      }));
      previousReplies.push(message.content);
    }
  }
  return turnScores;
}

function coverageRatios(messages: ChatMessage[], turnScores: TurnScore[]): Record<DimensionKey, number> {
  const replies = messages.filter((message) => message.role === "apprentice").map((message) => message.content);
  const text = replies.join("\n");
  const quality = analyzeConversationQuality(messages);
  const riskyPromise = hasAny(text, ["肯定给您", "一定退款", "保证退款", "保证赔偿", "百分百", "绝对可以"]);
  const offPlatform = hasAny(text, ["删差评", "撤投诉", "私下处理", "加微信", "微信转账", "支付宝转账"]);
  const blame = hasAny(text, ["都是你自己", "是你自己的问题", "你自己造成", "跟我们没关系", "自己看", "没办法", "谁让你"]);
  const riskWeight = turnScores.reduce((sum, turn) => sum + turn.weight, 0);
  const riskWeighted = riskWeight ? turnScores.reduce((sum, turn) => {
    const score = turn.dimensions.find((item) => item.key === "risk");
    return sum + (score ? score.score / score.maxScore : 0) * turn.weight;
  }, 0) / riskWeight : 0;
  const substantive = replies.filter((reply) => normalizeServiceText(reply).length >= 12).length;
  return {
    insight: ratioOf([hasAny(text, SIGNALS.issue), hasAny(text, SIGNALS.order), hasAny(text, SIGNALS.evidence),
      hasAny(text, SIGNALS.receiptTime), hasAny(text, SIGNALS.expectation), replies.some(hasQuestion)]),
    empathy: ratioOf([hasAny(replies.slice(0, 2).join("\n"), SIGNALS.empathy),
      hasAny(text, ["抱歉", "对不起", "不好意思", "给您添麻烦"]), hasAny(text, SIGNALS.ownership),
      !blame && !quality.moderatedTurns.length]),
    rule: ratioOf([hasAny(text, SIGNALS.rule), hasAny(text, SIGNALS.conditional), hasAny(text, SIGNALS.evidence),
      !riskyPromise && !offPlatform]),
    solution: ratioOf([hasAny(text, SIGNALS.solution), hasAny(text, SIGNALS.customerAction), hasAny(text, SIGNALS.timeline),
      hasAny(text, SIGNALS.followUp), hasAny(text, SIGNALS.close)]),
    risk: clamp(riskWeighted, 0, 1),
    expression: clamp(ratioOf([substantive >= Math.min(3, replies.length), quality.distinctReplyRatio >= 0.8,
      replies.some((reply) => /[，；：。]|第一|首先|然后|接下来/u.test(reply)), quality.lowInformationCount === 0,
      quality.exactRepeatCount === 0 && quality.nearRepeatCount === 0]), 0, 1)
  };
}

function aggregateDimensionScores(messages: ChatMessage[], turnScores: TurnScore[]) {
  const coverage = coverageRatios(messages, turnScores);
  return DIMENSIONS.map((dimension) => {
    const weighted = turnScores.reduce((accumulator, turn) => {
      const item = turn.dimensions.find((candidate) => candidate.key === dimension.key);
      const relevance = STAGE_RUBRIC[turn.stage][dimension.key] / 10;
      const weight = turn.weight * relevance;
      return { points: accumulator.points + (item ? item.score / item.maxScore : 0) * weight, weight: accumulator.weight + weight };
    }, { points: 0, weight: 0 });
    const turnRatio = weighted.weight ? weighted.points / weighted.weight : 0;
    const finalRatio = turnRatio * 0.7 + coverage[dimension.key] * 0.3;
    return { key: dimension.key, name: dimension.name, maxScore: dimension.maxScore,
      score: Math.round(clamp(finalRatio, 0, 1) * dimension.maxScore), turnRatio, coverageRatio: coverage[dimension.key] };
  });
}

function scoreCore(messages: ChatMessage[]) {
  const turnScores = collectTurnScores(messages);
  const quality = analyzeConversationQuality(messages);
  const dimensions = aggregateDimensionScores(messages, turnScores);
  const apprenticeText = messages.filter((message) => message.role === "apprentice").map((message) => message.content).join("\n");
  const hasSolution = hasAny(apprenticeText, SIGNALS.solution);
  const offPlatform = hasAny(apprenticeText, ["删差评", "撤投诉", "私下处理", "加微信", "微信转账", "支付宝转账"]);
  const blame = hasAny(apprenticeText, ["都是你自己", "是你自己的问题", "你自己造成", "跟我们没关系", "自己看", "没办法", "谁让你"]);
  const rawScore = dimensions.reduce((sum, item) => sum + item.score, 0);
  const penaltyTotal = quality.exactRepeatCount * 4 + quality.nearRepeatCount * 3 + quality.lowInformationCount * 2;
  let scoreCap = quality.scoreCap;
  if (offPlatform || blame) scoreCap = Math.min(scoreCap, 60);
  if (turnScores.length === 1) scoreCap = Math.min(scoreCap, 45);
  else if (turnScores.length === 2) scoreCap = Math.min(scoreCap, 65);
  if (!hasSolution) scoreCap = Math.min(scoreCap, 69);
  const totalScore = Math.round(Math.min(scoreCap, Math.max(0, rawScore - penaltyTotal)));
  return { turnScores, quality, dimensions, rawScore, totalScore, penaltyTotal, scoreCap, apprenticeText, offPlatform, blame };
}

export function evaluateConversationProgress(messages: ChatMessage[]): ConversationScoreProgress {
  const core = scoreCore(messages);
  return {
    currentScore: core.totalScore, rawScore: core.rawScore, completedTurns: core.turnScores.length,
    scoreCap: core.scoreCap, penaltyTotal: core.penaltyTotal,
    dimensions: core.dimensions.map(({ name, score, maxScore }) => ({ name, score, maxScore })),
    turnScores: core.turnScores,
    formula: "最终分＝六维分之和（逐轮表现70%＋全程能力覆盖30%）－全局质量扣分，再执行风险与最低轮次封顶"
  };
}

export function scoreLevel(score: number) {
  if (score >= 90) return "优秀";
  if (score >= 80) return "良好";
  if (score >= 70) return "合格";
  if (score >= 60) return "待提升";
  return "不合格";
}

function dimension(name: string, score: number, maxScore: number, evidence: string, deductionReason: string, improvement: string): DimensionScore {
  return { name, score: Math.round(clamp(score, 0, maxScore)), maxScore, evidence, deductionReason, improvement };
}

export function evaluateConversation(messages: ChatMessage[]): ScoreReport {
  const core = scoreCore(messages);
  const { turnScores, quality, apprenticeText, totalScore, rawScore } = core;
  const risks: RiskItem[] = [];
  for (const moderated of quality.moderatedTurns) {
    for (const violation of moderated.result.violations) {
      risks.push({ quote: `第${moderated.turn}轮：“${quote(moderated.content)}”`, type: violation.category,
        riskLevel: violation.severity === "critical" ? "重大风险" : "严重风险", reason: violation.reason,
        suggestedReplacement: violation.replacement });
    }
  }
  if (hasAny(apprenticeText, ["肯定给您", "一定退款", "保证退款", "保证赔偿", "百分百", "绝对可以"])) {
    risks.push({ quote: "出现未经核实的绝对承诺", type: "过度承诺", riskLevel: "一般风险",
      reason: "审核前承诺必然退款或赔偿，容易形成超权限承诺。",
      suggestedReplacement: "我先核实订单和凭证；符合售后规则后会立即提交申请，并同步审核时效。" });
  }
  if (core.offPlatform) {
    risks.push({ quote: "出现诱导删评、撤诉或平台外处理表达", type: "平台合规风险", riskLevel: "严重风险",
      reason: "真实客服不得以删评撤诉交换处理，也不得绕开平台交易。",
      suggestedReplacement: "您的反馈会在平台内如实登记，我会按售后流程继续跟进。" });
  }
  if (core.blame && !quality.moderatedTurns.some((item) => item.result.violations.some((violation) => violation.code === "blame-shifting"))) {
    risks.push({ quote: "出现推责或指责客户的表达", type: "情绪激化", riskLevel: "严重风险",
      reason: "未完成事实核实前直接归责，会把商品问题升级为服务态度投诉。",
      suggestedReplacement: "责任需要结合订单、页面信息和凭证判断，我先帮您核实清楚。" });
  }
  if (quality.exactRepeatCount || quality.nearRepeatCount) {
    risks.push({ quote: `检测到完全重复 ${quality.exactRepeatCount} 次、高度相似 ${quality.nearRepeatCount} 次`, type: "机械复读",
      riskLevel: quality.exactRepeatCount >= 2 ? "严重风险" : "一般风险",
      reason: "重复同一句话没有回应客户新增问题，并且所有重复轮次都已纳入加权分母。",
      suggestedReplacement: "先回应客户刚提出的新疑问，再补充下一步动作、责任人和反馈时点。" });
  }

  const dimensionDetails = core.dimensions.map((item) => {
    const relatedTurns = turnScores.map((turn) => ({ turn: turn.turn,
      item: turn.dimensions.find((candidate) => candidate.key === item.key) })).filter((entry) => entry.item);
    const weakestTurn = relatedTurns.slice().sort((left, right) => {
      const leftRatio = left.item ? left.item.score / left.item.maxScore : 0;
      const rightRatio = right.item ? right.item.score / right.item.maxScore : 0;
      return leftRatio - rightRatio;
    })[0];
    const improvement = item.key === "insight" ? "只追问客户尚未提供的信息，并逐项回应本轮新增诉求。"
      : item.key === "empathy" ? "首轮准确复述情绪和争议点，再明确由谁负责跟进。"
        : item.key === "rule" ? "说明规则适用条件、凭证用途和审核边界，避免绝对承诺。"
          : item.key === "solution" ? "方案需要同时包含双方动作、反馈时效、责任人和闭环确认。"
            : item.key === "risk" ? "不得辱骂、推责、诱导删评、平台外交易或越权承诺。"
              : "每轮必须回应新问题并带出新动作，避免机械复读和无效短句。";
    return dimension(item.name, item.score, item.maxScore,
      `逐轮加权表现 ${Math.round(item.turnRatio * 100)}%，全程能力覆盖 ${Math.round(item.coverageRatio * 100)}%。`,
      weakestTurn ? `第${weakestTurn.turn}轮是本维度相对薄弱的回合。` : "尚无可评价的学生回复。", improvement);
  });

  const strongTurns = turnScores.filter((turn) => turn.score >= 75).length;
  const weakTurns = turnScores.filter((turn) => turn.score < 60).length;
  const strengths = [strongTurns ? `${strongTurns}个回合达到较好以上的岗位表现` : "",
    hasAny(apprenticeText, SIGNALS.empathy) ? "能识别并承接客户情绪" : "",
    hasAny(apprenticeText, SIGNALS.conditional) ? "使用条件化表达控制了承诺边界" : "",
    hasAny(apprenticeText, SIGNALS.timeline) && hasAny(apprenticeText, SIGNALS.followUp) ? "方案包含时效和跟进节点" : ""].filter(Boolean);
  const weaknesses = [quality.moderatedTurns.length ? "出现职业红线或严重服务用语" : "",
    quality.exactRepeatCount || quality.nearRepeatCount ? "存在机械重复，弱回合已拉低整体加权分" : "",
    weakTurns ? `${weakTurns}个回合低于60分，需要逐轮复盘` : "",
    !hasAny(apprenticeText, SIGNALS.timeline) ? "方案缺少明确反馈时效" : "",
    !hasAny(apprenticeText, SIGNALS.close) ? "没有确认客户是否接受方案" : ""].filter(Boolean);

  return {
    rawScore, totalScore, level: scoreLevel(totalScore), passStatus: totalScore >= 70 ? "通过" : "未通过",
    summary: quality.moderatedTurns.length ? "本次接待触发职业语言风险。所有回合仍参与统计，但重大风险会执行硬性封顶。"
      : quality.exactRepeatCount || quality.nearRepeatCount ? "本次接待存在机械复读。重复回合不仅不能重复得分，还会进入加权分母并产生额外扣分。"
        : totalScore >= 80 ? "各轮回复整体能够随客户诉求推进，事实核实、规则边界和解决方案形成了较完整的证据链。"
          : "部分回合完成了基础动作，但逐轮针对性、规则边界或方案闭环仍不稳定，需要结合回合轨迹复盘。",
    dimensions: dimensionDetails,
    strengths: strengths.length ? strengths : ["能够完成基础客户回应"],
    weaknesses: weaknesses.length ? weaknesses : ["需要提高回复的针对性和行动闭环"],
    riskItems: risks,
    recommendedScript: "非常抱歉这次商品体验没有达到您的预期，我看到您已经提供订单号、自然光和室内照片，吊牌也未拆。关于色差、退款和额外赔偿需要分别核实：我先登记现有凭证并核对页面展示，符合退货条件会立即推进退款；赔偿部分按平台审核结果处理。我会在24小时内反馈进度，请问这样的推进方式您可以接受吗？",
    nextPractice: quality.moderatedTurns.length ? ["高压情绪下的职业表达", "冲突降级", "合规边界"]
      : quality.exactRepeatCount || quality.nearRepeatCount ? ["逐轮回应新问题", "去模板化表达", "方案推进"]
        : ["已知信息确认", "条件化方案", "时效与闭环"],
    skillTags: { strong: strengths.slice(0, 2).length ? strengths.slice(0, 2) : ["基础回应"],
      weak: weaknesses.slice(0, 2).length ? weaknesses.slice(0, 2) : ["对话推进"] },
    turnScores,
    scoringMethod: { turnContributionPercent: 70, coverageContributionPercent: 30,
      scoreCap: core.scoreCap, penaltyTotal: core.penaltyTotal,
      formula: "六维分＝逐轮阶段加权70%＋全程能力覆盖30%；最终分＝六维合计－复读/低信息全局扣分，再执行风险和最低轮次封顶。" }
  };
}
