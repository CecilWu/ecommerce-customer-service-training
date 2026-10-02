import type { ChatMessage, CustomerState, Product, ScoreReport, Task } from "@/lib/types";
import { customerDispositionInstruction, initialCustomerMessage, nextCustomerReply } from "@/lib/customer";
import { evaluateConversation } from "@/lib/scoring";
import type { KnowledgeHit } from "@/lib/rag/search";
import { formatKnowledge } from "@/lib/rag/search";
import { getRuntimeAIConfig } from "@/lib/ai/settings";
import { analyzeTurnQuality } from "@/lib/service-quality";

type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CustomerGenerationMeta = {
  usedModel: boolean;
  ruleDriven?: boolean;
  provider?: string;
  model?: string;
  error?: string;
};

type CustomerGenerationResult = {
  message: string;
  state: CustomerState;
  meta: CustomerGenerationMeta;
};

class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

const AI_REQUEST_TIMEOUT_MS = 45_000;
const AI_MAX_ATTEMPTS = 2;

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestChatCompletion(url: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok || !isRetryableStatus(response.status) || attempt === AI_MAX_ATTEMPTS) {
        return response;
      }
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if (attempt === AI_MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timeout);
    }

    await wait(500 * attempt);
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new AIUnavailableError("AI模型响应超时，请稍后重试");
  }
  throw new AIUnavailableError("AI模型网络连接失败，请稍后重试");
}

async function chatCompletion(messages: ModelMessage[], temperature = 0.7, maxTokens = 360) {
  const config = await getRuntimeAIConfig();
  if (!config) {
    throw new AIUnavailableError("管理员尚未配置可用AI模型或API Key");
  }

  const response = await requestChatCompletion(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new AIUnavailableError("AI模型认证失败，请在管理员后台检查API Key是否有效");
    }
    throw new AIUnavailableError(`AI模型调用失败：${response.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AIUnavailableError("AI模型没有返回有效内容");
  return {
    content,
    provider: config.provider,
    model: config.model
  };
}

function conversationText(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.role === "customer" ? "客户" : message.role === "apprentice" ? "客服学生" : "系统"}：${message.content}`)
    .join("\n");
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stripJsonFence(content: string) {
  return content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function limitCustomerReply(value: string, maxLength = 100) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  const shortened = compact.slice(0, maxLength);
  const ending = Math.max(shortened.lastIndexOf("。"), shortened.lastIndexOf("？"), shortened.lastIndexOf("！"));
  return ending >= 45 ? shortened.slice(0, ending + 1) : `${shortened.slice(0, maxLength - 1)}…`;
}

function escalationSignals(value: string) {
  return ["差评", "投诉", "曝光", "举报", "赔偿", "虚假宣传"]
    .filter((signal) => value.includes(signal)).length + (/不.{0,12}就/u.test(value) ? 2 : 0);
}

function parseCustomerJson(content: string, fallbackState: CustomerState) {
  const cleaned = stripJsonFence(content);
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned) as {
    reply?: string;
    state?: Partial<CustomerState>;
  };
  const reply = limitCustomerReply(String(parsed.reply || "").replace(/^客户[:：]/, ""));
  if (!reply) throw new Error("missing reply");
  return {
    message: reply,
    state: {
      ...fallbackState,
      emotion: clamp(parsed.state?.emotion ?? fallbackState.emotion),
      trust: clamp(parsed.state?.trust ?? fallbackState.trust),
      resolution: clamp(parsed.state?.resolution ?? fallbackState.resolution)
    }
  };
}

function customerSystemPrompt() {
  return [
    "你是电商售后实训系统中的“真实客户扮演智能体”。",
    "你不是客服、不是老师、不是评分员，只能扮演客户本人。",
    "你的任务是根据学生客服的上一句回复，生成客户下一句真实反应，用来训练中职电子商务专业学生的客服实战能力。",
    "客户首先是普通消费者，不是固定的刁难机器人。可以有情绪、追问和质疑，但不能辱骂、人身攻击、诱导违法或索要平台外交易。",
    "不要机械复读，不要每轮都说“你一直讲流程”。必须回应学生刚才说的具体内容。",
    "必须持续记住订单事实、已有凭证、客户画像和前文承诺，不能自行编造与任务单冲突的新事实。",
    "法律常识边界：七天无理由退货且商品完好时，退回运费通常由消费者承担，另有约定除外；商品确实不符合质量要求时，经营者承担退换修所需的必要运输费用；额外惩罚性赔偿需要欺诈等事实和法定依据，不能只因客户提出就默认成立。",
    "客户可以依法投诉，但不得利用投诉牟取不正当利益。客服把退款、运费、赔偿依据和时效解释清楚后，客户应按事实接受成立或不成立的结论。",
    "如果学生准确复述问题、真诚共情、完成关键信息核实，并给出合法、可执行、有时效和跟进节点的方案，客户情绪必须下降、信任和解决进度必须上升；合理解决后必须明确接受，不能为了刁难而无限抬杠。",
    "如果学生只说套话、推责、过度承诺、回避关键问题或给出与规则冲突的方案，客户要针对具体漏洞升级质疑。情绪变化应连续自然，单轮通常变化5-18分，重大失误或完整闭环可更明显。",
    "只能输出JSON，不要Markdown，不要解释。格式：{\"reply\":\"客户下一句话\",\"state\":{\"emotion\":0-100,\"trust\":0-100,\"resolution\":0-100}}"
  ].join("\n");
}

function difficultyInstruction(difficulty: Task["difficulty"]) {
  if (difficulty === "hard") {
    return "困难：争议复杂且初始情绪较强，客户可能提差评、投诉或赔偿，但难度来自事实核实和规则边界，不等于客户必须无理取闹。";
  }
  if (difficulty === "medium") {
    return "中等：明显不满。客户会追问、质疑效率和规则，但仍愿意配合专业处理。";
  }
  return "简单：真实克制。客户表达不满和疑问，语气较理性。";
}

function customerUserPrompt({
  task,
  product,
  messages,
  state,
  knowledge,
  isOpening = false
}: {
  task: Task;
  product: Product;
  messages: ChatMessage[];
  state: CustomerState;
  knowledge: KnowledgeHit[];
  isOpening?: boolean;
}) {
  const lastApprentice = [...messages].reverse().find((message) => message.role === "apprentice")?.content ?? "尚未开始";
  const apprenticeReplies = messages.filter((message) => message.role === "apprentice").map((message) => message.content);
  const turnQuality = apprenticeReplies.length
    ? analyzeTurnQuality(apprenticeReplies[apprenticeReplies.length - 1], apprenticeReplies.slice(0, -1))
    : null;
  const productKnowledge = [
    product.faq.length ? `产品FAQ：\n${product.faq.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "",
    product.policy.length ? `售后规则：\n${product.policy.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
  return [
    `任务标题：${task.title}`,
    `客户事件/场景：${task.scenario}`,
    `客户画像与沟通特征：${task.customerProfile || "有合理售后诉求的普通消费者"}`,
    `订单事实：订单号${task.orderInfo.orderNo || "未提供"}；下单/签收${task.orderInfo.placedAt || "未提供"}；实付${task.orderInfo.amount || "未提供"}；数量${task.orderInfo.quantity || "未提供"}；规格${task.orderInfo.variant || "未提供"}；物流状态${task.orderInfo.logisticsStatus || "未提供"}；现有凭证${task.orderInfo.evidenceStatus || "未提供"}。`,
    `任务类型：${task.type === "exam" ? "正式出师考核" : task.type === "assessment" ? "阶段测评" : "日常训练"}`,
    `难度要求：${difficultyInstruction(task.difficulty)}`,
    `本会话客户合作倾向：${customerDispositionInstruction(state.disposition)} 此倾向在整个会话内保持一致。`,
    `训练目标：${task.objectives.join("、") || "客户接待、售后处理、风险合规"}`,
    `产品信息：${product.name}（${product.category}）。${product.description}`,
    `产品资料库参考，只作为客户掌握的背景，不要直接背规则：\n${productKnowledge || "暂无内置产品资料。"}`,
    `企业上传FAQ检索参考，只作为客户掌握的背景，不要直接背规则：\n${formatKnowledge(knowledge)}`,
    `当前客户状态：情绪${state.emotion}/100，信任${state.trust}/100，解决进度${state.resolution}/100。`,
    isOpening
      ? "现在生成客户开场第一句话。要求像真实买家主动找客服，带出具体问题、核心诉求和情绪。"
      : `学生客服上一句：${lastApprentice}`,
    !isOpening && turnQuality?.warningTitle
      ? `系统质检结论：${turnQuality.warningTitle}。${turnQuality.warningMessage} 客户必须针对该问题作出真实反应，不能因为句中同时含有“理解、退款、时效”等词就提高信任或解决进度。`
      : "系统质检结论：本轮未触发硬性语言风险，仍需根据内容是否真正回应客户来判断。",
    `完整对话记录：\n${conversationText(messages) || "暂无"}`,
    [
      "生成要求：",
      "1. 只输出客户的话，不替学生回答。",
      "2. 原则上100字以内，口语化，有真实电商咨询或投诉现场感；普通客户一次只问1到2个核心问题。",
      "3. 不重复最近两句客户话术。",
      "4. 必须推动训练目标，例如追问凭证、质疑规则、要求时效、要求解释、担心无人跟进等。",
      "5. JSON里的state要根据学生回复质量变化：情绪高表示更生气，信任高表示更相信客服，解决进度高表示更接近闭环。",
      "6. 当方案合法、清晰、可执行，并回应退款、运费、赔偿依据和时效后，客户必须接受方案；高要求客户最多多做一次合理确认，不得无限追加条件。",
      "7. 不得把所有客户都写成索赔、威胁差评或投诉；开场诉求应服从任务事实和本会话客户合作倾向。"
    ].join("\n")
  ].join("\n\n");
}

function modelMeta(provider?: string, model?: string): CustomerGenerationMeta {
  return { usedModel: true, provider, model };
}

function fallbackMeta(error: unknown): CustomerGenerationMeta {
  return {
    usedModel: false,
    error: error instanceof Error ? error.message : "AI模型暂不可用，已启用本地应急模拟"
  };
}

export async function generateInitialCustomerReply({
  task,
  product,
  state,
  knowledge
}: {
  task: Task;
  product: Product;
  state: CustomerState;
  knowledge: KnowledgeHit[];
}): Promise<CustomerGenerationResult> {
  const fallback = {
    message: initialCustomerMessage(task, product, state),
    state
  };

  try {
    const completion = await chatCompletion(
      [
        { role: "system", content: customerSystemPrompt() },
        { role: "user", content: customerUserPrompt({ task, product, messages: [], state, knowledge, isOpening: true }) }
      ],
      task.difficulty === "hard" ? 0.78 : 0.68
    );
    const parsed = parseCustomerJson(completion.content, state);
    const message = state.disposition === "rational" && escalationSignals(parsed.message) >= 3
      ? fallback.message
      : parsed.message;
    return { message, state, meta: modelMeta(completion.provider, completion.model) };
  } catch (error) {
    return { ...fallback, meta: fallbackMeta(error) };
  }
}

export async function generateCustomerReply({
  task,
  product,
  messages,
  state,
  knowledge
}: {
  task: Task;
  product: Product;
  messages: ChatMessage[];
  state: CustomerState;
  knowledge: KnowledgeHit[];
}): Promise<CustomerGenerationResult> {
  const fallback = nextCustomerReply({ task, product, messages, state });
  const apprenticeReplies = messages.filter((message) => message.role === "apprentice").map((message) => message.content);
  const turnQuality = apprenticeReplies.length
    ? analyzeTurnQuality(apprenticeReplies[apprenticeReplies.length - 1], apprenticeReplies.slice(0, -1))
    : null;

  // 硬性职业红线、机械复读和无信息短句由确定性规则接管，避免模型被表面关键词误导，
  // 同时让警告响应不受外部模型延迟影响。
  if (turnQuality?.warningTitle) {
    return {
      ...fallback,
      meta: {
        usedModel: false,
        ruleDriven: true,
        error: `本轮触发“${turnQuality.warningTitle}”，已由岗位质检规则生成客户反应`
      }
    };
  }

  if (fallback.state.accepted) {
    return {
      ...fallback,
      meta: {
        usedModel: false,
        ruleDriven: true,
        error: "学生已给出完整合规方案，客户按真实沟通逻辑接受处理"
      }
    };
  }

  try {
    const completion = await chatCompletion(
      [
        { role: "system", content: customerSystemPrompt() },
        { role: "user", content: customerUserPrompt({ task, product, messages, state, knowledge }) }
      ],
      task.difficulty === "hard" ? 0.76 : 0.68
    );

    const parsed = parseCustomerJson(completion.content, fallback.state);
    const serviceImproved = fallback.state.emotion < state.emotion && fallback.state.resolution > state.resolution;
    const modelEscalatedWithoutCause = serviceImproved && state.disposition !== "demanding" && escalationSignals(parsed.message) >= 2;
    return {
      message: modelEscalatedWithoutCause ? fallback.message : parsed.message,
      // 状态变化由确定性规则计算，避免模型在优质回复后反向提高情绪或降低解决进度。
      state: fallback.state,
      meta: modelMeta(completion.provider, completion.model)
    };
  } catch (error) {
    return { ...fallback, meta: fallbackMeta(error) };
  }
}

export async function generateScoreReport({
  messages,
  task,
  product,
  knowledge
}: {
  messages: ChatMessage[];
  task?: Task;
  product?: Product;
  knowledge: KnowledgeHit[];
}): Promise<ScoreReport> {
  const fallback = evaluateConversation(messages);

  try {
    const completion = await chatCompletion(
      [
        {
          role: "system",
          content:
            "你是企业电商客服质检总监和职业教育评价专家。请基于“岗境证据链-六维四阶”评价体系，生成严格、可改进、可教学的个性化诊断报告。必须只输出JSON，不要Markdown。"
        },
        {
          role: "user",
          content: [
            `任务：${task?.title ?? "客服训练"}`,
            `场景：${task?.scenario ?? "未提供"}`,
            `产品：${product?.name ?? "未提供"}`,
            `知识参考：\n${formatKnowledge(knowledge)}`,
            `规则评分初稿：\n${JSON.stringify(fallback, null, 2)}`,
            `对话记录：\n${conversationText(messages)}`,
            "程序已经完成逐轮证据评分、阶段权重、全程能力覆盖、重复度检测、违禁用语扣分和风险封顶。你只能优化summary、evidence、deductionReason、improvement、strengths、weaknesses、recommendedScript和nextPractice的文字，不得修改任何分数、maxScore、level、passStatus、riskItems、skillTags、turnScores或scoringMethod。输出字段必须与初稿JSON结构完全一致。"
          ].join("\n\n")
        }
      ],
      0.25
    );

    const json = JSON.parse(stripJsonFence(completion.content)) as Partial<ScoreReport>;
    if (!Array.isArray(json.dimensions)) return fallback;

    const safeText = (value: unknown, fallbackValue: string, maxLength = 600) =>
      typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallbackValue;
    const safeList = (value: unknown, fallbackValue: string[]) => {
      if (!Array.isArray(value)) return fallbackValue;
      const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 6);
      return items.length ? items : fallbackValue;
    };

    return {
      ...fallback,
      summary: safeText(json.summary, fallback.summary),
      dimensions: fallback.dimensions.map((baseDimension) => {
        const candidate = json.dimensions?.find((item) => item?.name === baseDimension.name);
        return {
          ...baseDimension,
          evidence: safeText(candidate?.evidence, baseDimension.evidence, 300),
          deductionReason: safeText(candidate?.deductionReason, baseDimension.deductionReason, 300),
          improvement: safeText(candidate?.improvement, baseDimension.improvement, 300)
        };
      }),
      strengths: safeList(json.strengths, fallback.strengths),
      weaknesses: safeList(json.weaknesses, fallback.weaknesses),
      recommendedScript: safeText(json.recommendedScript, fallback.recommendedScript, 800),
      nextPractice: safeList(json.nextPractice, fallback.nextPractice)
    };
  } catch {
    return fallback;
  }
}

export async function generateTaskAssistDraft({
  scenario,
  objectives,
  productName,
  productDescription,
  difficulty,
  type
}: {
  scenario: string;
  objectives: string;
  productName: string;
  productDescription: string;
  difficulty: string;
  type: string;
}) {
  const completion = await chatCompletion(
    [
      {
        role: "system",
        content:
          "你是企业电商客服培训任务设计专家。请帮助师父把任务情境和能力目标补充得更真实、更适合中职电商客服实训。只输出JSON，不要Markdown。"
      },
      {
        role: "user",
        content: [
          `产品：${productName}`,
          `产品资料：${productDescription || "暂无"}`,
          `任务类型：${type}`,
          `训练难度：${difficulty}`,
          `师父已写任务情境：${scenario || "暂无"}`,
          `师父已写能力目标：${objectives || "暂无"}`,
          "请输出：{\"scenario\":\"300字以内的完整任务情境，写清订单事实、争议焦点、客户诉求、客服任务和合规边界\",\"objectives\":\"5项以内能力目标，用中文分号分隔，总长100字以内\"}。",
          "任务情境要让徒弟明确要核实什么、解决什么、何时反馈；不能泄露标准答案。能力目标要可评价、可训练。"
        ].join("\n")
      }
    ],
    0.35,
    260
  );
  const cleaned = stripJsonFence(completion.content);
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned) as { scenario?: string; objectives?: string };
  return {
    scenario: String(parsed.scenario || scenario).trim().slice(0, 500),
    objectives: String(parsed.objectives || objectives).trim().slice(0, 100)
  };
}
