import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const projectDir = process.cwd();
const outputDir = mkdtempSync(path.join(tmpdir(), "ecommerce-quality-regression-"));
const require = createRequire(import.meta.url);

function check(condition, label) {
  if (!condition) throw new Error(`失败：${label}`);
  console.log(`通过：${label}`);
}

function message(role, content, index) {
  return { id: String(index), role, content, createdAt: new Date(index * 1000).toISOString() };
}

function conversation(replies) {
  return replies.flatMap((reply, index) => [
    message("customer", index ? `客户第${index + 1}轮追问新的处理信息` : "商品存在色差，我要求退款并说明处理时间", index * 2),
    message("apprentice", reply, index * 2 + 1)
  ]);
}

try {
  execFileSync(
    path.join(projectDir, "node_modules", ".bin", "tsc"),
    [
      "lib/scoring.ts",
      "lib/service-quality.ts",
      "lib/service-language-lexicon.ts",
      "lib/customer.ts",
      "lib/types.ts",
      "--outDir", outputDir,
      "--module", "commonjs",
      "--target", "es2020",
      "--moduleResolution", "node",
      "--esModuleInterop",
      "--skipLibCheck",
      "--noEmit", "false"
    ],
    { cwd: projectDir, stdio: "inherit" }
  );

  const { evaluateConversation, evaluateConversationProgress } = require(path.join(outputDir, "scoring.js"));
  const { moderateServiceLanguage, analyzeTurnQuality } = require(path.join(outputDir, "service-quality.js"));
  const { createInitialCustomerState, initialCustomerMessage, nextCustomerReply, selectCustomerDisposition } = require(path.join(outputDir, "customer.js"));
  const goodReplies = [
    "非常抱歉影响您的体验，我理解您对商品色差和页面展示的担心。请问您的订单号和签收时间是什么？",
    "麻烦您提供自然光下的商品实拍照片、吊牌和外包装，我来帮您核实页面信息与商品情况。",
    "核实后如果符合退货规则，我会为您提交退款申请并持续跟进，预计24小时内反馈进度。这样的方案您可以接受吗？"
  ];
  const repeatedReply = "非常理解您的心情，请提供订单号和照片，核实后符合规则我会在24小时内为您申请退款并反馈。";

  const good = evaluateConversation(conversation(goodReplies));
  const repeated = evaluateConversation(conversation([repeatedReply, repeatedReply, repeatedReply, repeatedReply]));
  const profanity = evaluateConversation(conversation(["你就是个傻 逼，爱投诉就投诉", ...goodReplies.slice(1)]));
  const lowInformation = evaluateConversation(conversation(["好的", "好的", "好的"]));
  const goodThenWeak = evaluateConversation(conversation([...goodReplies, "好的"]));
  const progress = evaluateConversationProgress(conversation(goodReplies));
  const providedContext = "订单TB20260705002，照片和吊牌我都已经拍了，商品有明显色差。";
  const redundantProgress = evaluateConversationProgress([
    message("customer", providedContext, 1),
    message("apprentice", "麻烦您再提供订单号和照片，我核实一下。", 2)
  ]);
  const contextAwareProgress = evaluateConversationProgress([
    message("customer", providedContext, 1),
    message("apprentice", "非常抱歉给您带来困扰，我已看到订单号、照片和吊牌情况，我先核对页面颜色展示并为您跟进。", 2)
  ]);
  const customerTask = {
    id: "hard-complaint",
    title: "色差售后",
    type: "assessment",
    productId: "coat",
    scenario: "客户认为颜色与页面不符，要求退款并询问赔偿。",
    customerProfile: "客户情绪较强，但解释清楚后愿意配合。",
    orderInfo: { orderNo: "TB20260705002", placedAt: "已签收", amount: "329", quantity: "1", variant: "浅灰M码", logisticsStatus: "已签收", evidenceStatus: "已有照片" },
    difficulty: "hard",
    objectives: [], timeLimit: 20, roundLimit: 8, allowRetry: true, showHints: false, reportVisibleMode: "immediately"
  };
  const customerProduct = { id: "coat", name: "浅灰色外套", category: "服装", description: "", faq: [], policy: [], standardScripts: [], forbiddenScripts: [] };
  const opening = message("customer", "颜色和页面不一致，我要退货。运费谁出，额外赔偿有没有？", 1);
  const completeReply = "非常抱歉影响体验，我已核实订单和照片。若核实为页面描述不符，可申请退货退款，质量问题运费由商家承担；额外赔偿需按欺诈和实际损失证据审核。今天提交后24小时内反馈，由我持续跟进。这个方案可以吗？";
  const secondCompleteReply = "现有照片已经登记，我会按质量问题退货流程处理商家承担的运费；赔偿仍以欺诈证据审核结果为准，最晚24小时内由我反馈工单进度，请您确认是否接受。";
  const rationalState = createInitialCustomerState("hard", 10);
  const rationalResult = nextCustomerReply({ task: customerTask, product: customerProduct, messages: [opening, message("apprentice", completeReply, 2)], state: rationalState });
  const demandingState = createInitialCustomerState("hard", 99);
  const demandingFirst = nextCustomerReply({ task: customerTask, product: customerProduct, messages: [opening, message("apprentice", completeReply, 2)], state: demandingState });
  const demandingSecond = nextCustomerReply({
    task: customerTask,
    product: customerProduct,
    messages: [opening, message("apprentice", completeReply, 2), message("customer", demandingFirst.message, 3), message("apprentice", secondCompleteReply, 4)],
    state: demandingFirst.state
  });
  const incompleteLegalReply = "很抱歉影响体验，我已核实订单和照片，可以申请退货，质量问题运费由商家承担，24小时内反馈。";
  const incompleteLegalResult = nextCustomerReply({
    task: customerTask,
    product: customerProduct,
    messages: [opening, message("apprentice", incompleteLegalReply, 2)],
    state: rationalState
  });

  check(!moderateServiceLanguage("商品有问题，请提供照片").triggered, "正常业务表达不误报");
  check(!moderateServiceLanguage("请提供一下妈妈的订单号").triggered, "亲属称谓业务句不误报");
  check(!moderateServiceLanguage("滚筒洗衣机支持七天无理由退货").triggered, "包含近似字的商品名不误报");
  check(moderateServiceLanguage("你就是个傻  逼").severity === "critical", "空格变形辱骂可识别");
  check(moderateServiceLanguage("你真是 s b").severity === "critical", "拼音缩写辱骂可识别");
  check(analyzeTurnQuality(repeatedReply, [repeatedReply]).exactRepeat, "完全重复可识别");
  check(good.totalScore >= 70, "完整专业多轮可以通过");
  check(repeated.totalScore <= 50, "多轮机械复读最高50分");
  check(profanity.totalScore <= 40, "辱骂触发40分以下封顶");
  check(profanity.riskItems.some((item) => item.riskLevel === "重大风险"), "辱骂进入重大风险报告");
  check(lowInformation.totalScore < 60, "低信息复读不能通过");
  check(progress.turnScores.length === goodReplies.length, "每一轮客服回复都有独立评分记录");
  check(progress.formula.includes("逐轮表现70%"), "实时进度返回可追溯的权重公式");
  check(goodThenWeak.totalScore < good.totalScore, "末尾无效回复会拉低综合成绩");
  check(
    contextAwareProgress.turnScores[0].score > redundantProgress.turnScores[0].score,
    "正确使用客户已提供信息优于重复索要"
  );
  check(selectCustomerDisposition("hard", 0) === "rational" && selectCustomerDisposition("hard", 71) === "rational", "困难任务仍以普通理性客户为主");
  check(selectCustomerDisposition("hard", 99) === "demanding", "高要求客户仅落入尾部小概率区间");
  check(!/差评|投诉/u.test(initialCustomerMessage(customerTask, customerProduct, rationalState)), "理性客户开场不默认威胁差评投诉");
  check(rationalResult.state.accepted === true && /接受|配合|提交/u.test(rationalResult.message), "理性客户收到完整合规方案后会接受");
  check(incompleteLegalResult.state.accepted === false && /赔偿/u.test(incompleteLegalResult.message), "未解释赔偿依据时客户只追问缺失问题");
  check(demandingFirst.state.accepted === false, "高要求客户允许多做一次合理确认");
  check(demandingSecond.state.accepted === true, "高要求客户不能无限追加条件");

  console.log("\n客服语言与评分回归测试全部通过。");
  console.log(`样例分数：专业对话 ${good.totalScore}；机械复读 ${repeated.totalScore}；辱骂 ${profanity.totalScore}；低信息复读 ${lowInformation.totalScore}。`);
  console.log(`公平性样例：专业对话后追加无效回复 ${goodThenWeak.totalScore}；重复索要已知信息 ${redundantProgress.turnScores[0].score}；正确使用已知信息 ${contextAwareProgress.turnScores[0].score}。`);
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
