import type { ChatMessage, CustomerDisposition, CustomerState, Difficulty, Product, Task } from "./types";
import { analyzeTurnQuality } from "./service-quality";

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function hasAny(text: string, words: readonly string[]) {
  return words.some((word) => text.includes(word));
}

function pick<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function textSeed(text: string) {
  return Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), text.length);
}

export function selectCustomerDisposition(difficulty: Difficulty, roll: number): CustomerDisposition {
  const normalizedRoll = Math.max(0, Math.min(99, Math.floor(roll)));
  if (difficulty === "easy") return normalizedRoll < 90 ? "rational" : normalizedRoll < 98 ? "cautious" : "demanding";
  if (difficulty === "medium") return normalizedRoll < 82 ? "rational" : normalizedRoll < 96 ? "cautious" : "demanding";
  return normalizedRoll < 72 ? "rational" : normalizedRoll < 92 ? "cautious" : "demanding";
}

export function createInitialCustomerState(difficulty: Difficulty, roll: number): CustomerState {
  const disposition = selectCustomerDisposition(difficulty, roll);
  const base = difficulty === "hard"
    ? { emotion: 78, trust: 24, resolution: 8 }
    : difficulty === "medium"
      ? { emotion: 54, trust: 38, resolution: 14 }
      : { emotion: 34, trust: 52, resolution: 22 };
  const adjustment = disposition === "rational"
    ? { emotion: -6, trust: 5 }
    : disposition === "demanding"
      ? { emotion: 6, trust: -5 }
      : { emotion: 0, trust: 0 };
  return {
    emotion: clamp(base.emotion + adjustment.emotion),
    trust: clamp(base.trust + adjustment.trust),
    resolution: base.resolution,
    disposition,
    goodServiceTurns: 0,
    accepted: false
  };
}

export function customerDispositionInstruction(disposition: CustomerDisposition = "rational") {
  if (disposition === "demanding") {
    return "少量出现的高要求客户：会多做一轮合理确认，语气强硬，但不得捏造损失、无限追加条件或拒绝清楚合法的最终方案。";
  }
  if (disposition === "cautious") {
    return "谨慎客户：会确认凭证、运费、审核和时效；问题解释完整后应当配合，最多再确认一个仍未说明的关键点。";
  }
  return "普通理性客户：提出真实问题，得到清楚、合法、可执行的解释后应明显缓和并接受，不得为了增加难度继续找茬。";
}

export function initialCustomerMessage(task: Task, product: Product, state?: CustomerState) {
  const orderLead = task.orderInfo.orderNo ? `订单${task.orderInfo.orderNo}，` : "";
  const disposition = state?.disposition ?? "rational";
  if (task.difficulty === "hard") {
    if (disposition === "demanding") {
      return `${orderLead}我收到的${product.name}和页面描述差别很大，现有凭证我都保留了。请一次说明能否退货、运费、审核时效和赔偿依据。`;
    }
    return `${orderLead}我收到的${product.name}和页面描述有明显差别，想申请退货。运费怎么承担，额外赔偿是否有依据，多久能处理？`;
  }
  if (task.difficulty === "medium") {
    return `${orderLead}收到的${product.name}出现了任务里描述的问题，我有些不满意。请问需要提供哪些信息，准备怎么处理？`;
  }
  return `${orderLead}收到${product.name}后发现了任务里描述的问题，想咨询一下具体如何处理。`;
}

function acceptedMessage(disposition: CustomerDisposition, seed: number) {
  const options = disposition === "demanding"
    ? [
        "行，这次退货、运费、审核和时效都说清楚了。我先按流程提交，请按承诺节点反馈。",
        "可以，这个处理依据我明白了。我先配合申请，后续按你说的时间跟进就行。"
      ]
    : disposition === "cautious"
      ? [
          "好，规则和时间我清楚了，我先按你说的提交资料，请后续按时反馈。",
          "明白了，这个方案可以接受。我现在配合申请，有进度再通知我。"
        ]
      : [
          "好的，我明白了，这个处理方案可以接受。我现在按你说的提交申请。",
          "可以，规则和时效都说清楚了，我先配合处理，谢谢。"
        ];
  return pick(options, seed);
}

export function nextCustomerReply({
  task,
  product,
  messages,
  state
}: {
  task: Task;
  product: Product;
  messages: ChatMessage[];
  state: CustomerState;
}) {
  const last = [...messages].reverse().find((message) => message.role === "apprentice");
  if (!last) return { message: initialCustomerMessage(task, product, state), state };

  const text = last.content;
  const apprenticeTurns = messages.filter((message) => message.role === "apprentice").length;
  const apprenticeReplies = messages.filter((message) => message.role === "apprentice").map((message) => message.content);
  const customerText = messages.filter((message) => message.role === "customer").map((message) => message.content).join("\n");
  const turnQuality = analyzeTurnQuality(text, apprenticeReplies.slice(0, -1));
  const disposition = state.disposition ?? "rational";
  const seed = textSeed(`${text}-${apprenticeTurns}-${state.emotion}-${state.trust}-${state.resolution}-${disposition}`);

  if (state.accepted) {
    return {
      message: pick(["好的，方案已经确认，我等后续处理结果。", "明白，我已经按流程提交了，后续有进度通知我即可。"], seed),
      state: { ...state, emotion: Math.min(state.emotion, 22), trust: Math.max(state.trust, 72), resolution: 100, accepted: true }
    };
  }

  const empathized = hasAny(text, ["理解", "抱歉", "不好意思", "影响体验", "着急", "感受"]);
  const verified = hasAny(text, ["订单", "收货", "照片", "凭证", "吊牌", "时间", "核实", "页面"]);
  const solution = hasAny(text, ["退换", "退货", "换货", "退款", "申请", "售后", "补发", "维修"]);
  const timeline = hasAny(text, ["小时", "工作日", "今天", "明天", "时效", "反馈", "到账"]);
  const conditional = hasAny(text, ["核实后", "符合", "如果", "若", "审核", "根据凭证", "以平台"]);
  const followUp = hasAny(text, ["跟进", "工单", "登记", "反馈进度", "联系您", "通知您"]);
  const close = hasAny(text, ["可以吗", "是否接受", "能否接受", "是否认可", "确认一下"]);
  const risky = hasAny(text, ["肯定", "一定退款", "保证退款", "保证赔偿", "删差评", "私下", "微信转账"]);
  const blame = hasAny(text, ["你自己", "不是我们", "没办法", "规定就是", "自己看", "谁让你"]);
  const needsCompensationAnswer = hasAny(customerText, ["赔偿", "赔付", "补偿"]);
  const addressesCompensation = !needsCompensationAnswer || hasAny(text, ["赔偿", "赔付", "补偿", "欺诈", "审核依据", "实际损失"]);
  const needsFreightAnswer = hasAny(customerText, ["运费", "邮费", "寄回"]);
  const addressesFreight = !needsFreightAnswer || hasAny(text, ["运费", "邮费", "寄回", "退货包运费", "运输费用"]);
  const completeSolution = solution && timeline && conditional && addressesCompensation && addressesFreight;
  const positiveTurn = completeSolution && !risky && !blame && !turnQuality.moderation.triggered;
  const goodServiceTurns = Math.max(0, (state.goodServiceTurns ?? 0) + (positiveTurn ? 1 : 0));

  let emotion = state.emotion;
  let trust = state.trust;
  let resolution = state.resolution;
  const positiveFactor = disposition === "rational" ? 1.15 : disposition === "demanding" ? 0.85 : 1;

  if (empathized) {
    emotion -= Math.round(10 * positiveFactor);
    trust += Math.round(8 * positiveFactor);
  } else if (apprenticeTurns === 1 && task.difficulty !== "easy") {
    emotion += disposition === "demanding" ? 8 : 4;
  }
  if (verified) {
    trust += Math.round(10 * positiveFactor);
    resolution += Math.round(8 * positiveFactor);
  }
  if (solution) {
    trust += Math.round(8 * positiveFactor);
    resolution += Math.round((timeline ? 22 : 14) * positiveFactor);
    emotion -= Math.round(8 * positiveFactor);
  }
  if (timeline) {
    trust += Math.round(5 * positiveFactor);
    resolution += Math.round(6 * positiveFactor);
  }
  if (conditional) trust += Math.round(5 * positiveFactor);
  if (followUp || close) resolution += Math.round(6 * positiveFactor);
  if (risky) {
    emotion += 3;
    trust -= 16;
  }
  if (blame) {
    emotion += 25;
    trust -= 25;
    resolution -= 8;
  }
  if (turnQuality.moderation.triggered) {
    emotion += turnQuality.moderation.severity === "critical" ? 28 : 18;
    trust -= turnQuality.moderation.severity === "critical" ? 38 : 25;
    resolution -= turnQuality.moderation.severity === "critical" ? 15 : 8;
  } else if (turnQuality.exactRepeat || turnQuality.nearRepeat) {
    emotion += 14;
    trust -= 18;
    resolution -= 7;
  } else if (turnQuality.lowInformation) {
    emotion += 8;
    trust -= 9;
    resolution -= 3;
  }

  emotion = clamp(emotion);
  trust = clamp(trust);
  resolution = clamp(resolution);
  const shouldAccept = completeSolution && (
    disposition === "rational" ||
    (disposition === "cautious" && (resolution >= 62 || goodServiceTurns >= 2)) ||
    (disposition === "demanding" && (resolution >= 82 || goodServiceTurns >= 2))
  );

  if (shouldAccept) {
    return {
      message: acceptedMessage(disposition, seed),
      state: {
        ...state,
        emotion: Math.min(emotion, disposition === "demanding" ? 34 : 24),
        trust: Math.max(trust, disposition === "demanding" ? 62 : 70),
        resolution: Math.max(resolution, 90),
        disposition,
        goodServiceTurns,
        accepted: true
      }
    };
  }

  let message = "";
  if (turnQuality.moderation.triggered) {
    message = pick([
      "你刚才是在辱骂或威胁我吗？商品问题还没处理，我要求立即升级投诉并记录这次服务态度。",
      "这种表达我不能接受。请停止人身攻击，转交能够正常沟通的客服处理。",
      "我来解决订单问题，不是来承受侮辱的。请明确道歉，并让主管继续处理售后。"
    ], seed);
  } else if (turnQuality.exactRepeat || turnQuality.nearRepeat) {
    message = pick([
      "这句话你已经说过了。我刚才问的是下一步由谁处理、什么时候反馈，请正面回答。",
      "你又在重复同一套话术，没有回应我的新问题。请告诉我具体动作和时间点。"
    ], seed);
  } else if (turnQuality.lowInformation) {
    message = pick([
      "这几个字解决不了问题。请说明你核实什么、我需要提供什么、什么时候有结果。",
      "你的回复没有实际信息，我还是不知道下一步怎么办，请给我完整处理方案。"
    ], seed);
  } else if (blame) {
    message = pick([
      "问题还没有核实，不能直接归责给我。请按订单和凭证继续处理。",
      `我买的是${product.name}，希望你先核实事实，不要直接把责任推给客户。`
    ], seed);
  } else if (risky) {
    message = "请不要先作绝对承诺，把适用条件、审核流程和预计时间说明清楚就可以。";
  } else if (!empathized && apprenticeTurns === 1 && task.difficulty !== "easy") {
    message = pick([
      `我主要担心${product.name}和页面描述不一致。请先回应这个问题，再说明怎么处理。`,
      "我现在确实不满意，但愿意配合核实。请直接说明需要什么信息和处理方向。"
    ], seed);
  } else if (!verified) {
    message = pick([
      "可以核实，请一次说明还缺哪些信息，已经提供过的就不要让我重复提交。",
      "我愿意配合。订单、照片或视频具体还缺哪一项，请列清楚。"
    ], seed);
  } else if (!solution) {
    message = pick([
      "信息我可以配合，但核实之后是退货、换货还是其他处理？请说明可选方案。",
      "资料已经说清楚了，我现在想确认具体处理路径。"
    ], seed);
  } else if (!addressesFreight) {
    message = "退货方案我明白了。请再说明寄回运费由谁承担、需要先垫付还是平台直接处理。";
  } else if (!addressesCompensation) {
    message = "退款方案我明白了。额外赔偿是否成立，请把审核依据说清楚；没有依据也可以直接说明。";
  } else if (!timeline) {
    message = pick([
      "方案可以，那预计多久审核、退款多久能到账？把时间节点说清楚我就配合。",
      "处理方向我理解了，请再告诉我最晚什么时候反馈结果。"
    ], seed);
  } else if (!conditional) {
    message = "处理方向可以，但请说明适用条件和审核依据，避免后面出现不同说法。";
  } else if (disposition === "demanding" && goodServiceTurns < 2) {
    message = "这次解释基本清楚了。我最后确认一下：提交后由谁跟进，超过时效我应该从哪里查询？";
  } else {
    message = pick([
      "好的，这个解释我能理解。我先按要求提交资料，请后续及时反馈。",
      "可以，我先配合申请。剩余进度按你说的节点通知我就行。"
    ], seed);
  }

  return {
    message,
    state: { ...state, emotion, trust, resolution, disposition, goodServiceTurns, accepted: false }
  };
}
