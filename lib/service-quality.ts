import { SERVICE_LANGUAGE_RULES, type ServiceLanguageRule } from "./service-language-lexicon";
import type { ChatMessage } from "./types";

export type ServiceLanguageViolation = {
  code: string;
  category: string;
  severity: "serious" | "critical";
  penalty: number;
  scoreCap: number;
  matchedHint: string;
  reason: string;
  replacement: string;
};

export type ServiceModerationResult = {
  triggered: boolean;
  severity: "none" | "serious" | "critical";
  penalty: number;
  scoreCap: number;
  warningTitle: string;
  warningMessage: string;
  violations: ServiceLanguageViolation[];
};

export type TurnQualityResult = {
  moderation: ServiceModerationResult;
  exactRepeat: boolean;
  nearRepeat: boolean;
  similarity: number;
  repeatedRound: number | null;
  lowInformation: boolean;
  penalty: number;
  warningTitle: string;
  warningMessage: string;
};

export type ConversationQuality = {
  apprenticeTurns: number;
  exactRepeatCount: number;
  nearRepeatCount: number;
  lowInformationCount: number;
  distinctReplyRatio: number;
  moderationPenalty: number;
  qualityPenalty: number;
  scoreCap: number;
  moderatedTurns: Array<{ turn: number; content: string; result: ServiceModerationResult }>;
};

function compactText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10))
    .replace(/[\s\p{P}\p{S}_]+/gu, "")
    .replace(/(.)\1{2,}/gu, "$1");
}
export function normalizeServiceText(value: string) {
  return compactText(value);
}

function maskMatched(value: string) {
  if (!value) return "已识别风险表达";
  if (value.length <= 2) return `${value.slice(0, 1)}*`;
  return `${value.slice(0, 1)}${"*".repeat(Math.min(4, value.length - 2))}${value.slice(-1)}`;
}

function matchRule(rule: ServiceLanguageRule, raw: string, compact: string) {
  const matchedTerm = rule.terms?.find((term) => compact.includes(compactText(term)));
  if (matchedTerm) return matchedTerm;
  const matchedPattern = rule.patterns?.find((pattern) => pattern.test(raw.normalize("NFKC").toLowerCase()));
  return matchedPattern ? "变形表达" : null;
}

export function moderateServiceLanguage(text: string): ServiceModerationResult {
  const compact = compactText(text);
  const violations = SERVICE_LANGUAGE_RULES.flatMap((rule) => {
    const matched = matchRule(rule, text, compact);
    if (!matched) return [];
    return [
      {
        code: rule.code,
        category: rule.category,
        severity: rule.severity,
        penalty: rule.penalty,
        scoreCap: rule.scoreCap,
        matchedHint: maskMatched(matched),
        reason: rule.reason,
        replacement: rule.replacement
      } satisfies ServiceLanguageViolation
    ];
  });

  if (!violations.length) {
    return {
      triggered: false,
      severity: "none",
      penalty: 0,
      scoreCap: 100,
      warningTitle: "",
      warningMessage: "",
      violations: []
    };
  }

  const severity = violations.some((item) => item.severity === "critical") ? "critical" : "serious";
  const penalty = Math.min(40, violations.reduce((sum, item) => sum + item.penalty, 0));
  const scoreCap = Math.min(...violations.map((item) => item.scoreCap));
  const categories = [...new Set(violations.map((item) => item.category))].join("、");

  return {
    triggered: true,
    severity,
    penalty,
    scoreCap,
    warningTitle: severity === "critical" ? "职业红线警告" : "严重服务用语警告",
    warningMessage: `系统识别到${categories}。本条已记入质检，将扣减风险与表达得分，并触发总分封顶。`,
    violations
  };
}

function bigrams(value: string) {
  const chars = Array.from(value);
  if (chars.length < 2) return new Set(chars);
  return new Set(chars.slice(0, -1).map((char, index) => `${char}${chars[index + 1]}`));
}

export function textSimilarity(left: string, right: string) {
  const a = bigrams(compactText(left));
  const b = bigrams(compactText(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function isLowInformation(text: string) {
  const compact = compactText(text);
  if (compact.length < 6) return true;
  return /^(您好|亲|好的|好吧|知道了|嗯|哦|行|可以|稍等|抱歉|对不起|没问题|我看看|等一下){1,3}$/u.test(compact);
}

export function analyzeTurnQuality(content: string, previousApprenticeReplies: string[]): TurnQualityResult {
  const normalized = compactText(content);
  let similarity = 0;
  let repeatedRound: number | null = null;
  let exactRepeat = false;

  previousApprenticeReplies.forEach((previous, index) => {
    const currentSimilarity = textSimilarity(content, previous);
    if (currentSimilarity > similarity) {
      similarity = currentSimilarity;
      repeatedRound = index + 1;
    }
    if (normalized && normalized === compactText(previous)) {
      exactRepeat = true;
      repeatedRound = index + 1;
      similarity = 1;
    }
  });

  const nearRepeat = !exactRepeat && normalized.length >= 8 && similarity >= 0.82;
  const lowInformation = isLowInformation(content);
  const moderation = moderateServiceLanguage(content);
  const repetitionPenalty = exactRepeat ? 14 : nearRepeat ? 9 : 0;
  const lowInformationPenalty = lowInformation ? 6 : 0;
  const penalty = moderation.penalty + repetitionPenalty + lowInformationPenalty;

  let warningTitle = moderation.warningTitle;
  let warningMessage = moderation.warningMessage;
  if (!warningTitle && (exactRepeat || nearRepeat)) {
    warningTitle = "机械重复警告";
    warningMessage = `本条与第 ${repeatedRound ?? "前"} 轮回复${exactRepeat ? "完全相同" : "高度相似"}。重复套话不会重复得分，并将扣减职业表达和问题推进得分。`;
  } else if (!warningTitle && lowInformation) {
    warningTitle = "低信息回复提醒";
    warningMessage = "本条没有提供足够的核实、解释或处理动作，将被判定为无效推进并扣分。";
  }

  return {
    moderation,
    exactRepeat,
    nearRepeat,
    similarity,
    repeatedRound,
    lowInformation,
    penalty,
    warningTitle,
    warningMessage
  };
}

export function analyzeConversationQuality(messages: ChatMessage[]): ConversationQuality {
  const replies = messages.filter((message) => message.role === "apprentice");
  const previous: string[] = [];
  let exactRepeatCount = 0;
  let nearRepeatCount = 0;
  let lowInformationCount = 0;
  let moderationPenalty = 0;
  let scoreCap = 100;
  const moderatedTurns: ConversationQuality["moderatedTurns"] = [];

  replies.forEach((message, index) => {
    const result = analyzeTurnQuality(message.content, previous);
    if (result.exactRepeat) exactRepeatCount += 1;
    if (result.nearRepeat) nearRepeatCount += 1;
    if (result.lowInformation) lowInformationCount += 1;
    if (result.moderation.triggered) {
      moderationPenalty += result.moderation.penalty;
      scoreCap = Math.min(scoreCap, result.moderation.scoreCap);
      moderatedTurns.push({ turn: index + 1, content: message.content, result: result.moderation });
    }
    previous.push(message.content);
  });

  const uniqueReplies = new Set(replies.map((message) => compactText(message.content))).size;
  const distinctReplyRatio = replies.length ? uniqueReplies / replies.length : 0;
  const qualityPenalty =
    moderationPenalty + exactRepeatCount * 14 + nearRepeatCount * 9 + lowInformationCount * 6;

  if (exactRepeatCount >= 2 || distinctReplyRatio <= 0.5) scoreCap = Math.min(scoreCap, 50);
  else if (exactRepeatCount + nearRepeatCount >= 2) scoreCap = Math.min(scoreCap, 60);

  return {
    apprenticeTurns: replies.length,
    exactRepeatCount,
    nearRepeatCount,
    lowInformationCount,
    distinctReplyRatio,
    moderationPenalty,
    qualityPenalty,
    scoreCap,
    moderatedTurns
  };
}
