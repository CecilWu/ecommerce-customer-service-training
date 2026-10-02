/**
 * 客服岗位语言风险词库。
 *
 * 这里只收录与客服训练直接相关的辱骂、人身攻击、威胁和敌对驱赶表达，
 * 不把政治、医疗、商品名称等“大而全敏感词”混入业务判断，以降低误报。
 * 规则会在 NFKC 归一化、大小写统一并移除空格/符号后匹配。
 */

export type ServiceLanguageRule = {
  code: string;
  category: string;
  severity: "serious" | "critical";
  penalty: number;
  scoreCap: number;
  terms?: string[];
  patterns?: RegExp[];
  reason: string;
  replacement: string;
};

export const SERVICE_LANGUAGE_RULES: ServiceLanguageRule[] = [
  {
    code: "violent-threat",
    category: "威胁恐吓",
    severity: "critical",
    penalty: 32,
    scoreCap: 25,
    terms: ["弄死你", "整死你", "杀了你", "打死你", "废了你", "砸了你", "找人收拾你", "让你吃不了兜着走"],
    patterns: [/让你.{0,4}(好看|后悔)/u, /找人.{0,4}(堵你|打你|收拾你)/u],
    reason: "客服对客户实施威胁属于职业红线，会直接升级投诉并带来人身安全风险。",
    replacement: "我理解您现在很不满意，我先核实事实，并按平台流程为您推进处理。"
  },
  {
    code: "explicit-profanity",
    category: "脏话辱骂",
    severity: "critical",
    penalty: 28,
    scoreCap: 35,
    terms: [
      "操你妈", "草你妈", "艹你妈", "肏你妈", "日你妈", "你妈逼", "尼玛逼", "草泥马",
      "狗日的", "他妈的", "傻b"
    ],
    patterns: [
      /(?:^|[^a-z])(c[\s._-]*n[\s._-]*m|n[\s._-]*m[\s._-]*s[\s._-]*l|w[\s._-]*q[\s._-]*n[\s._-]*m[\s._-]*d|s[\s._-]*b|cao[\s._-]*ni[\s._-]*ma|sha[\s._-]*bi)(?:[^a-z]|$)/iu
    ],
    reason: "客服使用脏话会造成直接冒犯，属于不可接受的职业表达。",
    replacement: "我先完整了解您的问题，请给我一点时间核实订单和处理规则。"
  },
  {
    code: "personal-insult",
    category: "人身攻击",
    severity: "critical",
    penalty: 26,
    scoreCap: 40,
    terms: [
      "傻逼", "煞笔", "傻比", "沙比", "蠢货", "废物", "脑残", "弱智", "智障", "白痴",
      "狗东西", "王八蛋", "贱人", "畜生", "穷鬼", "乡巴佬", "垃圾人", "你有病", "神经病吧"
    ],
    reason: "针对客户人格或能力的贬损会激化冲突，属于重大服务风险。",
    replacement: "我们先回到订单问题本身，我会根据您提供的信息继续核实。"
  },
  {
    code: "sexual-harassment",
    category: "性别侮辱或骚扰",
    severity: "critical",
    penalty: 30,
    scoreCap: 30,
    terms: ["婊子", "臭婊子", "骚货", "贱女人", "卖身的", "陪睡", "去卖"],
    reason: "性别侮辱和性骚扰是严重职业失范，不能出现在任何客户沟通中。",
    replacement: "请允许我继续为您核实商品与售后问题，我们只讨论本次订单。"
  },
  {
    code: "hostile-dismissal",
    category: "敌对驱赶",
    severity: "serious",
    penalty: 16,
    scoreCap: 55,
    terms: [
      "爱买不买", "不买拉倒", "随便投诉", "要投诉就投诉", "你去投诉", "闭嘴", "别烦我",
      "你滚", "滚开", "滚蛋", "关我屁事", "关我什么事", "懒得理你", "自己看去", "没长眼"
    ],
    reason: "驱赶、挑衅或蔑视客户会把售后问题升级成服务态度投诉。",
    replacement: "您的投诉权利会得到尊重，我先把当前问题和可执行方案说明清楚。"
  },
  {
    code: "blame-shifting",
    category: "指责推诿",
    severity: "serious",
    penalty: 12,
    scoreCap: 65,
    terms: [
      "都是你自己", "是你自己的问题", "你自己造成的", "跟我们没关系", "不是我们的责任",
      "我管不了", "我也没办法", "规定就是这样", "自己看详情", "谁让你"
    ],
    reason: "未经核实就归责或用规则堵住客户，会破坏信任并妨碍问题解决。",
    replacement: "责任需要结合订单和凭证核实，我先说明需要的信息与后续处理节点。"
  }
];
