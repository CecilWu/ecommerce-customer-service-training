import type {
  ChatMessage as DbChatMessage,
  Difficulty as DbDifficulty,
  MessageRole as DbMessageRole,
  Product as DbProduct,
  Task as DbTask,
  TaskType as DbTaskType
} from "@prisma/client";
import type { ChatMessage, Difficulty, Product, Task, TaskType } from "./types";

export function toAppDifficulty(difficulty: DbDifficulty): Difficulty {
  if (difficulty === "EASY") return "easy";
  if (difficulty === "HARD") return "hard";
  return "medium";
}

export function toDbDifficulty(difficulty: string): DbDifficulty {
  if (difficulty === "easy") return "EASY";
  if (difficulty === "hard") return "HARD";
  return "MEDIUM";
}

export function toAppTaskType(type: DbTaskType): TaskType {
  if (type === "ASSESSMENT") return "assessment";
  if (type === "EXAM") return "exam";
  return "daily";
}

export function toDbTaskType(type: string): DbTaskType {
  if (type === "assessment") return "ASSESSMENT";
  if (type === "exam") return "EXAM";
  return "DAILY";
}

export function toAppRole(role: DbMessageRole): ChatMessage["role"] {
  if (role === "CUSTOMER") return "customer";
  if (role === "SYSTEM") return "system";
  return "apprentice";
}

export function toDbRole(role: ChatMessage["role"]): DbMessageRole {
  if (role === "customer") return "CUSTOMER";
  if (role === "system") return "SYSTEM";
  return "APPRENTICE";
}

export function productFromDb(product: DbProduct): Product {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    faq: product.faqText.split("\n").filter(Boolean),
    policy: product.policyText.split("\n").filter(Boolean),
    standardScripts: ["先承接客户情绪，再核实订单和凭证。", "说明规则边界时避免绝对承诺。"],
    forbiddenScripts: ["肯定能退。", "您先把差评删了。", "这不是我们的问题。"]
  };
}

export function taskFromDb(task: DbTask): Task {
  let objectives: string[] = [];
  try {
    objectives = JSON.parse(task.objectivesJson) as string[];
  } catch {
    objectives = task.objectivesJson.split(/[;；,\n]/).filter(Boolean);
  }

  let orderInfo: Task["orderInfo"] = {
    orderNo: "",
    placedAt: "",
    amount: "",
    quantity: "",
    variant: "",
    logisticsStatus: "",
    evidenceStatus: ""
  };
  try {
    orderInfo = { ...orderInfo, ...(JSON.parse(task.orderInfoJson) as Partial<Task["orderInfo"]>) };
  } catch {
    // 兼容尚未迁移的历史任务。
  }

  return {
    id: task.id,
    title: task.title,
    type: toAppTaskType(task.type),
    productId: task.productId,
    scenario: task.scenario,
    customerProfile: task.customerProfile,
    orderInfo,
    difficulty: toAppDifficulty(task.difficulty),
    objectives,
    timeLimit: task.timeLimit,
    roundLimit: task.roundLimit,
    allowRetry: task.allowRetry,
    showHints: task.showHints,
    reportVisibleMode: task.reportVisibleMode === "mentor_review" ? "mentor_review" : "immediately"
  };
}

export function messageFromDb(message: DbChatMessage): ChatMessage {
  return {
    id: message.id,
    role: toAppRole(message.role),
    content: message.content,
    createdAt: message.createdAt.toISOString()
  };
}
