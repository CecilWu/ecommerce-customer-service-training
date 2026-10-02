export type TaskType = "daily" | "assessment" | "exam";
export type Difficulty = "easy" | "medium" | "hard";
export type MessageRole = "customer" | "apprentice" | "system";
export type CustomerDisposition = "rational" | "cautious" | "demanding";

export type CustomerState = {
  emotion: number;
  trust: number;
  resolution: number;
  disposition?: CustomerDisposition;
  goodServiceTurns?: number;
  accepted?: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  faq: string[];
  policy: string[];
  standardScripts: string[];
  forbiddenScripts: string[];
};

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  productId: string;
  scenario: string;
  customerProfile: string;
  orderInfo: {
    orderNo: string;
    placedAt: string;
    amount: string;
    quantity: string;
    variant: string;
    logisticsStatus: string;
    evidenceStatus: string;
  };
  difficulty: Difficulty;
  objectives: string[];
  timeLimit: number;
  roundLimit: number;
  allowRetry: boolean;
  showHints: boolean;
  reportVisibleMode: "immediately" | "mentor_review";
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type RiskItem = {
  quote: string;
  type: string;
  riskLevel: "一般风险" | "严重风险" | "重大风险";
  reason: string;
  suggestedReplacement: string;
};

export type DimensionScore = {
  name: string;
  score: number;
  maxScore: number;
  evidence: string;
  deductionReason: string;
  improvement: string;
};

export type TurnDimensionScore = {
  key: "insight" | "empathy" | "rule" | "solution" | "risk" | "expression";
  name: string;
  score: number;
  maxScore: number;
};

export type TurnScore = {
  turn: number;
  apprenticeMessageId: string;
  customerMessageId: string | null;
  stage: "接待安抚" | "事实核实" | "方案推进" | "闭环确认";
  weight: number;
  rawScore: number;
  penalty: number;
  scoreCap: number;
  score: number;
  dimensions: TurnDimensionScore[];
  strengths: string[];
  issues: string[];
  suggestion: string;
};

export type ConversationScoreProgress = {
  currentScore: number;
  rawScore: number;
  completedTurns: number;
  scoreCap: number;
  penaltyTotal: number;
  dimensions: Array<{ name: string; score: number; maxScore: number }>;
  turnScores: TurnScore[];
  formula: string;
};

export type ScoreReport = {
  totalScore: number;
  rawScore: number;
  level: string;
  passStatus: string;
  summary: string;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  riskItems: RiskItem[];
  recommendedScript: string;
  nextPractice: string[];
  skillTags: {
    strong: string[];
    weak: string[];
  };
  turnScores?: TurnScore[];
  scoringMethod?: {
    turnContributionPercent: number;
    coverageContributionPercent: number;
    scoreCap: number;
    penaltyTotal: number;
    formula: string;
  };
};
