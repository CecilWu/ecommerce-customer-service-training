import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const actual = Buffer.from(hash, "hex");
  const expected = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function upsertUser({ username, password, role, className = null, organizationUnitId = null }) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && verifyPassword(password, existing.passwordHash)) {
    return prisma.user.update({
      where: { username },
      data: {
        role,
        className,
        organizationUnitId,
        isActive: true
      }
    });
  }
  return prisma.user.upsert({
    where: { username },
    update: {
      passwordHash: hashPassword(password),
      role,
      className,
      organizationUnitId,
      isActive: true
    },
    create: {
      username,
      passwordHash: hashPassword(password),
      role,
      className,
      organizationUnitId,
      isActive: true
    }
  });
}

async function upsertOrgUnit({ id, name, type, description }) {
  return prisma.organizationUnit.upsert({
    where: { id },
    update: {
      name,
      type,
      description,
      isActive: true
    },
    create: {
      id,
      name,
      type,
      description,
      isActive: true
    }
  });
}

async function upsertProduct({ id, name, category, description, faqText, policyText }) {
  return prisma.product.upsert({
    where: { id },
    update: {
      name,
      category,
      description,
      faqText,
      policyText
    },
    create: {
      id,
      name,
      category,
      description,
      faqText,
      policyText
    }
  });
}

function enrichFaqText(product) {
  const common = [
    `咨询${product.name}是否适合特定人群或场景时，应先确认客户实际需求、使用环境和关键限制，不能只回答“适合”。`,
    "客户反馈“与预期不符”时，应核实订单规格、页面描述、实物照片、签收时间和使用状态，再区分主观体验、物流问题或商品质量问题。",
    "客户申请售后时，需要一次性告知订单号、面单、外包装、商品全貌、问题细节等所需凭证，避免反复补充材料。",
    "处理方案应说明可选路径、申请入口、预计审核时效、责任运费和下一次反馈节点，并在结束前确认客户是否接受。"
  ];
  return [...new Set([...String(product.faqText || "").split("\n").filter(Boolean), ...common])].join("\n");
}

async function main() {
  await upsertOrgUnit({
    id: "dept-training-center",
    name: "电子商务实训中心",
    type: "DEPARTMENT",
    description: "电子商务企业岗位实训带教单元"
  });

  await upsertOrgUnit({
    id: "dept-customer-service-teaching",
    name: "电商客服实训教研组",
    type: "DEPARTMENT",
    description: "客服课程带教与教研协作单元"
  });

  const classOne = await upsertOrgUnit({
    id: "class-ecommerce-service-1",
    name: "电商客服实训1班",
    type: "CLASS",
    description: "徒弟账号默认实训班级"
  });

  const admin = await upsertUser({
    username: "admin",
    password: "admin",
    role: "ADMIN",
    className: null
  });

  const legacyMentor = await prisma.user.findUnique({ where: { username: "mentor" } });
  const existingTeacher = await prisma.user.findUnique({ where: { username: "teacher" } });
  if (legacyMentor && !existingTeacher) {
    await prisma.user.update({
      where: { username: "mentor" },
      data: { username: "teacher" }
    });
  }

  const mentor = await upsertUser({
    username: "teacher",
    password: "teacher",
    role: "MASTER",
    className: null
  });

  await prisma.organizationUnit.updateMany({
    data: { ownerId: mentor.id }
  });

  const student = await upsertUser({
    username: "student",
    password: "student",
    role: "APPRENTICE",
    className: classOne.name,
    organizationUnitId: classOne.id
  });

  const coat = await prisma.product.upsert({
    where: { id: "coat" },
    update: {
      name: "女士休闲外套",
      category: "服装",
      description: "春秋款休闲外套，版型略宽松，支持7天无理由退换。不同屏幕和光线下可能存在轻微色差。",
      faqText: "尺码偏差在1-3厘米属于正常测量范围。\n未剪吊牌、未水洗、未影响二次销售时支持退换。\n商品质量问题需提供清晰照片或视频作为凭证。",
      policyText: "签收后7天内可申请退换货。\n非质量问题退换货由客户承担寄回运费。\n质量问题核实后可由商家承担退换运费。\n客服不得在未核实前承诺退款或赔偿。"
    },
    create: {
      id: "coat",
      name: "女士休闲外套",
      category: "服装",
      description: "春秋款休闲外套，版型略宽松，支持7天无理由退换。不同屏幕和光线下可能存在轻微色差。",
      faqText: "尺码偏差在1-3厘米属于正常测量范围。\n未剪吊牌、未水洗、未影响二次销售时支持退换。\n商品质量问题需提供清晰照片或视频作为凭证。",
      policyText: "签收后7天内可申请退换货。\n非质量问题退换货由客户承担寄回运费。\n质量问题核实后可由商家承担退换运费。\n客服不得在未核实前承诺退款或赔偿。"
    }
  });

  const earphone = await prisma.product.upsert({
    where: { id: "earphone" },
    update: {
      name: "蓝牙耳机",
      category: "数码",
      description: "入门款真无线蓝牙耳机，支持基础通话和音乐播放，提供一年有限质保。",
      faqText: "首次使用需撕掉充电触点保护膜。\n单耳无声可尝试重置配对。\n人为损坏、进水、摔坏不在免费质保范围内。",
      policyText: "质量问题需先进行故障排查。\n符合质保条件可维修或换新。\n不支持无凭证直接赔偿。"
    },
    create: {
      id: "earphone",
      name: "蓝牙耳机",
      category: "数码",
      description: "入门款真无线蓝牙耳机，支持基础通话和音乐播放，提供一年有限质保。",
      faqText: "首次使用需撕掉充电触点保护膜。\n单耳无声可尝试重置配对。\n人为损坏、进水、摔坏不在免费质保范围内。",
      policyText: "质量问题需先进行故障排查。\n符合质保条件可维修或换新。\n不支持无凭证直接赔偿。"
    }
  });

  const dailyProducts = await Promise.all([
    upsertProduct({
      id: "fresh-cherries",
      name: "车厘子礼盒",
      category: "生鲜水果",
      description: "冷链配送的进口车厘子礼盒，按果径和重量售卖，生鲜受运输、温度和签收时效影响较大。",
      faqText: "果径存在轻微差异，按整箱平均规格判断。\n生鲜签收后需尽快开箱验货并冷藏。\n轻微软果、果梗脱落不等同于整箱质量问题。\n严重腐坏需提供外箱、内盒、坏果和面单照片。",
      policyText: "生鲜商品不支持无理由退货。\n签收后24小时内反馈并提供凭证，可按损耗比例协商处理。\n因拒收、延迟取件或保存不当造成损耗，商家不承担全责。\n客服不得承诺整箱退款，需先核实损耗比例。"
    }),
    upsertProduct({
      id: "instant-oatmeal",
      name: "即食燕麦片",
      category: "食品饮料",
      description: "家庭早餐即食燕麦片，独立包装，主打低糖饱腹，口味和颗粒感存在个人感受差异。",
      faqText: "低糖不等于无糖，配料表和营养成分表以包装标识为准。\n运输中外箱轻微变形不影响内袋食用。\n开封后需密封保存，避免受潮结块。\n口味不适属于主观体验问题。",
      policyText: "食品拆封后非质量问题不支持退货。\n临期、破袋、异物等需提供清晰照片和批次信息。\n未拆封且不影响二次销售，可按平台规则申请退货。\n客服不得承诺食用效果或健康功效。"
    }),
    upsertProduct({
      id: "smart-thermos",
      name: "智能保温杯",
      category: "家居日用",
      description: "带温度显示的智能保温杯，适合通勤饮水，电子温显和杯体保温属于两个不同功能模块。",
      faqText: "温度显示为杯盖传感器估算，存在轻微误差。\n保温效果与水量、环境温度、开盖次数有关。\n杯盖电子模块不可长时间浸泡。\n初次使用建议用温水清洗并通风去味。",
      policyText: "杯体漏水、明显破损需提供视频核实。\n温显异常可先更换电池或检查杯盖触点。\n人为摔碰、浸泡导致电子模块损坏不在免费质保范围。\n符合质量问题可换新或维修，不支持无凭证赔偿。"
    }),
    upsertProduct({
      id: "air-fryer",
      name: "空气炸锅",
      category: "生活小家电",
      description: "家用容量空气炸锅，适合薯条、鸡翅等日常烹饪，首次使用可能存在新机加热气味。",
      faqText: "首次加热有轻微气味属于新机保护油挥发，建议空烧清洁。\n烹饪效果与食材大小、油脂含量和翻面频次有关。\n容量标注为锅篮空间，实际食材不可装满。\n机器工作时外壳局部发热属正常现象。",
      policyText: "通电故障需提供插电、指示灯和机器反应视频。\n非质量问题退货需保持主机、锅篮、说明书和包装完整。\n使用后油污明显会影响二次销售，可能不支持无理由退货。\n不得承诺烹饪效果与宣传图完全一致。"
    }),
    upsertProduct({
      id: "sensitive-skin-cream",
      name: "敏感肌保湿面霜",
      category: "美妆个护",
      description: "基础保湿面霜，主打温和修护，肤感、吸收速度和适用情况因个人肤质存在差异。",
      faqText: "敏感肌适用不代表所有人都不会不适。\n建议首次使用前先做局部测试。\n膏体颜色和气味批次间可能有轻微差异。\n护肤品效果受肤质、使用频次和环境影响。",
      policyText: "化妆品拆封使用后非质量问题不支持退货。\n过敏不适需停止使用并提供订单、批次、使用情况说明。\n破损漏液可提供开箱视频和照片申请处理。\n客服不得承诺治疗、修复疾病或绝对不过敏。"
    }),
    upsertProduct({
      id: "baby-diaper",
      name: "婴儿纸尿裤",
      category: "母婴用品",
      description: "日常婴儿纸尿裤，按体重段选择尺码，漏尿和红屁屁可能与尺码、穿戴和个体肤质有关。",
      faqText: "尺码需按体重和宝宝腿围共同判断。\n漏尿常见原因包括尺码不合适、穿戴未整理防漏边、夜间尿量大。\n个别宝宝肤质敏感，建议先小包装试用。\n外箱压痕不影响内袋密封时一般不属于质量问题。",
      policyText: "母婴贴身用品拆封后非质量问题不支持退货。\n少片、破损、明显异物需提供批次和照片。\n质量问题核实后可补发、换货或退款。\n客服不得直接承诺红屁屁一定由产品质量导致。"
    }),
    upsertProduct({
      id: "cat-food",
      name: "全价猫粮",
      category: "宠物用品",
      description: "成猫全价猫粮，主打日常营养配方，适口性、软便等反馈受宠物体质和换粮方式影响。",
      faqText: "不同批次颗粒颜色和气味可能有轻微差异。\n换粮建议7天逐步过渡，突然换粮可能导致软便。\n适口性属于宠物个体差异。\n包装胀袋、破袋或异物需拍照保留。",
      policyText: "宠物食品拆封后非质量问题不支持退货。\n运输破损、漏气、临期可提供凭证申请处理。\n疑似质量问题需保留剩余产品、包装和批次。\n客服不得承诺宠物一定爱吃或一定改善健康问题。"
    }),
    upsertProduct({
      id: "yoga-mat",
      name: "加厚瑜伽垫",
      category: "运动户外",
      description: "家用加厚瑜伽垫，主打防滑和缓震，防滑表现会受地面材质、出汗量和动作强度影响。",
      faqText: "新垫轻微气味可通风散味。\n尺寸厚度存在少量工艺误差。\n防滑效果与地面清洁程度和使用方式有关。\n折痕可平铺一段时间后缓解。",
      policyText: "未使用且包装完整可按无理由规则退货。\n开封使用后有汗渍、压痕、污渍会影响二次销售。\n明显破损、开裂需提供照片核实。\n不得承诺所有地面和动作场景都绝对防滑。"
    }),
    upsertProduct({
      id: "office-paper",
      name: "A4复印纸",
      category: "办公文具",
      description: "办公常用A4复印纸，按克重和包数销售，运输中外包装可能有轻微压痕。",
      faqText: "纸张克重按标准称重范围判断。\n外箱轻微破损不代表内部纸张不可用。\n打印卡纸可能与打印机状态、纸张受潮和放纸方式有关。\n色泽批次间可能轻微不同。",
      policyText: "缺包、严重破损、受潮需提供外箱、内包装和面单照片。\n已拆封大量使用后不支持无理由退货。\n质量问题核实后可补发或退款。\n客服需先区分物流破损、保存问题和纸张质量问题。"
    }),
    upsertProduct({
      id: "carry-on-luggage",
      name: "20寸登机箱",
      category: "箱包配饰",
      description: "20寸旅行登机箱，万向轮、拉杆和箱体适合短途出行，不同航司登机要求可能不同。",
      faqText: "20寸尺寸为常见登机箱规格，但需以航司现场要求为准。\n新箱可能有轻微材质气味。\n运输中保护膜划痕不等于箱体划伤。\n拉杆轻微晃动属于伸缩结构正常间隙。",
      policyText: "签收后发现破损需尽快提供外箱和箱体照片。\n使用后轮子磨损、箱体刮痕影响二次销售。\n非质量问题退换货需保持吊牌、包装和配件完整。\n不得承诺所有航司都一定允许登机。"
    }),
    upsertProduct({
      id: "cotton-bedding-set",
      name: "纯棉四件套",
      category: "家纺床品",
      description: "纯棉床品四件套，主打亲肤透气，颜色、手感和缩水率会受洗涤方式影响。",
      faqText: "不同屏幕显示存在轻微色差。\n纯棉首次清洗可能有轻微浮色和缩水。\n面料支数和手感不等同于厚薄绝对值。\n建议按洗标低温清洗并避免暴晒。",
      policyText: "下水清洗后非质量问题不支持退货。\n未清洗未使用且不影响二次销售可申请退货。\n破洞、明显污渍、错发尺寸需提供照片核实。\n客服不得承诺完全不缩水或颜色与屏幕完全一致。"
    }),
    upsertProduct({
      id: "car-phone-holder",
      name: "车载手机支架",
      category: "汽车用品",
      description: "车载出风口手机支架，适合多数常见车型和手机尺寸，稳定性受出风口形状影响。",
      faqText: "异形、圆形或过厚出风口可能不适配。\n手机壳过厚会影响夹持稳定性。\n颠簸路况下支架晃动程度与车型和安装位置有关。\n安装前需确认卡扣方向和夹紧程度。",
      policyText: "不适配需提供车型、出风口照片和安装视频判断。\n非质量问题退货需保持配件完整。\n断裂、卡扣失效需提供清晰照片或视频。\n不得承诺适配所有车型和所有手机壳。"
    })
  ]);

  const knowledgeProducts = [coat, earphone, ...dailyProducts];
  for (const product of knowledgeProducts) {
    const faqText = enrichFaqText(product);
    await prisma.product.update({ where: { id: product.id }, data: { faqText } });
    await prisma.faqDocument.upsert({
      where: { id: `${product.id}-default-faq` },
      update: {
        title: `${product.name}默认产品资料`,
        content: `${product.description}\n${faqText}\n${product.policyText}`,
        productId: product.id,
        uploadedById: mentor.id
      },
      create: {
        id: `${product.id}-default-faq`,
        title: `${product.name}默认产品资料`,
        sourceType: "product",
        content: `${product.description}\n${faqText}\n${product.policyText}`,
        productId: product.id,
        uploadedById: mentor.id
      }
    });
  }

  const sampleTask = await prisma.task.upsert({
    where: { id: "sample" },
    update: {
      title: "尺码不符引发的退换货投诉",
      type: "DAILY",
      productId: coat.id,
      scenario: "客户购买女士休闲外套后发现L码实际穿着偏小，认为详情页尺码建议不准确。商品已试穿但吊牌未剪、未清洗。客服需核实订单、身高体重、页面尺码表、商品状态和凭证，判断是否符合退换条件，说明运费责任、申请路径和预计时效，并确认客户是否接受方案。",
      customerProfile: "客户重视处理效率，语气明显不满但愿意配合；担心客服只登记不跟进，会追问责任、运费和到账时间。",
      orderInfoJson: JSON.stringify({ orderNo: "TB20260705001", placedAt: "2026-07-03下单，2026-07-05签收", amount: "¥299.00", quantity: "1件", variant: "浅灰色/L码", logisticsStatus: "本人签收，外包装完好", evidenceStatus: "可提供订单截图、尺码表截图、商品及吊牌照片" }),
      organizationUnitId: classOne.id,
      difficulty: "MEDIUM",
      objectivesJson: JSON.stringify(["情绪安抚", "信息核实", "退换货处理", "方案闭环"]),
      timeLimit: 15,
      roundLimit: 12,
      allowRetry: true,
      showHints: true,
      reportVisibleMode: "immediately",
      createdById: mentor.id
    },
    create: {
      id: "sample",
      title: "尺码不符引发的退换货投诉",
      type: "DAILY",
      productId: coat.id,
      scenario: "客户购买女士休闲外套后发现L码实际穿着偏小，认为详情页尺码建议不准确。商品已试穿但吊牌未剪、未清洗。客服需核实订单、身高体重、页面尺码表、商品状态和凭证，判断是否符合退换条件，说明运费责任、申请路径和预计时效，并确认客户是否接受方案。",
      customerProfile: "客户重视处理效率，语气明显不满但愿意配合；担心客服只登记不跟进，会追问责任、运费和到账时间。",
      orderInfoJson: JSON.stringify({ orderNo: "TB20260705001", placedAt: "2026-07-03下单，2026-07-05签收", amount: "¥299.00", quantity: "1件", variant: "浅灰色/L码", logisticsStatus: "本人签收，外包装完好", evidenceStatus: "可提供订单截图、尺码表截图、商品及吊牌照片" }),
      organizationUnitId: classOne.id,
      difficulty: "MEDIUM",
      objectivesJson: JSON.stringify(["情绪安抚", "信息核实", "退换货处理", "方案闭环"]),
      timeLimit: 15,
      roundLimit: 12,
      allowRetry: true,
      showHints: true,
      reportVisibleMode: "immediately",
      createdById: mentor.id
    }
  });

  const hardTask = await prisma.task.upsert({
    where: { id: "hard-complaint" },
    update: {
      title: "差评威胁与赔偿索要处理",
      type: "ASSESSMENT",
      productId: coat.id,
      scenario: "客户购买浅灰色女士休闲外套，签收后认为实物颜色明显偏深，质疑详情页存在虚假宣传，要求全额退款并额外赔偿，否则将差评并申请平台介入。商品仅试穿、吊牌完整。客服需核实订单规格、展示环境、商品实拍、页面主图和是否存在质量问题，区分合理退货与未经核实的赔偿诉求，给出合规处理路径、凭证清单和明确反馈时效。",
      customerProfile: "客户熟悉平台投诉入口，情绪强烈且警惕推诿；若客服能正面回应色差争议、一次讲清凭证和时效，会逐步缓和并接受合理方案。",
      orderInfoJson: JSON.stringify({ orderNo: "TB20260705002", placedAt: "2026-07-02下单，2026-07-05签收", amount: "¥329.00", quantity: "1件", variant: "浅灰色/M码", logisticsStatus: "本人签收，外包装完好", evidenceStatus: "有订单截图、自然光与室内光实拍图，无完整开箱视频" }),
      organizationUnitId: classOne.id,
      difficulty: "HARD",
      objectivesJson: JSON.stringify(["高压投诉", "风险控制", "拒绝不合理要求"]),
      timeLimit: 12,
      roundLimit: 10,
      allowRetry: false,
      showHints: false,
      reportVisibleMode: "mentor_review",
      createdById: mentor.id
    },
    create: {
      id: "hard-complaint",
      title: "差评威胁与赔偿索要处理",
      type: "ASSESSMENT",
      productId: coat.id,
      scenario: "客户购买浅灰色女士休闲外套，签收后认为实物颜色明显偏深，质疑详情页存在虚假宣传，要求全额退款并额外赔偿，否则将差评并申请平台介入。商品仅试穿、吊牌完整。客服需核实订单规格、展示环境、商品实拍、页面主图和是否存在质量问题，区分合理退货与未经核实的赔偿诉求，给出合规处理路径、凭证清单和明确反馈时效。",
      customerProfile: "客户熟悉平台投诉入口，情绪强烈且警惕推诿；若客服能正面回应色差争议、一次讲清凭证和时效，会逐步缓和并接受合理方案。",
      orderInfoJson: JSON.stringify({ orderNo: "TB20260705002", placedAt: "2026-07-02下单，2026-07-05签收", amount: "¥329.00", quantity: "1件", variant: "浅灰色/M码", logisticsStatus: "本人签收，外包装完好", evidenceStatus: "有订单截图、自然光与室内光实拍图，无完整开箱视频" }),
      organizationUnitId: classOne.id,
      difficulty: "HARD",
      objectivesJson: JSON.stringify(["高压投诉", "风险控制", "拒绝不合理要求"]),
      timeLimit: 12,
      roundLimit: 10,
      allowRetry: false,
      showHints: false,
      reportVisibleMode: "mentor_review",
      createdById: mentor.id
    }
  });

  const finalTask = await prisma.task.upsert({
    where: { id: "final" },
    update: {
      title: "期末出师考核：综合客服接待",
      type: "EXAM",
      productId: earphone.id,
      scenario: "客户购买蓝牙耳机后第三天出现左耳无声，已尝试重新配对但未解决，现担心产品质量并要求退款。客服需独立完成诉求识别、订单与故障凭证核实、基础排障、质保规则说明和高压投诉应对，给出维修、换新或退款的条件化方案与时效，不得未经核实承诺赔偿。",
      customerProfile: "客户因新机故障非常着急，担心被反复要求排查；若客服操作指引清楚、方案有时效，会配合测试并接受符合质保规则的处理。",
      orderInfoJson: JSON.stringify({ orderNo: "TB20260705003", placedAt: "2026-07-01下单，2026-07-04签收", amount: "¥199.00", quantity: "1副", variant: "蓝色/标准版", logisticsStatus: "本人签收，包装完好", evidenceStatus: "有订单截图、故障录屏和充电仓照片" }),
      organizationUnitId: classOne.id,
      difficulty: "HARD",
      objectivesJson: JSON.stringify(["独立接待", "售后处理", "投诉应对", "风险合规"]),
      timeLimit: 30,
      roundLimit: 20,
      allowRetry: true,
      showHints: false,
      reportVisibleMode: "mentor_review",
      createdById: mentor.id
    },
    create: {
      id: "final",
      title: "期末出师考核：综合客服接待",
      type: "EXAM",
      productId: earphone.id,
      scenario: "客户购买蓝牙耳机后第三天出现左耳无声，已尝试重新配对但未解决，现担心产品质量并要求退款。客服需独立完成诉求识别、订单与故障凭证核实、基础排障、质保规则说明和高压投诉应对，给出维修、换新或退款的条件化方案与时效，不得未经核实承诺赔偿。",
      customerProfile: "客户因新机故障非常着急，担心被反复要求排查；若客服操作指引清楚、方案有时效，会配合测试并接受符合质保规则的处理。",
      orderInfoJson: JSON.stringify({ orderNo: "TB20260705003", placedAt: "2026-07-01下单，2026-07-04签收", amount: "¥199.00", quantity: "1副", variant: "蓝色/标准版", logisticsStatus: "本人签收，包装完好", evidenceStatus: "有订单截图、故障录屏和充电仓照片" }),
      organizationUnitId: classOne.id,
      difficulty: "HARD",
      objectivesJson: JSON.stringify(["独立接待", "售后处理", "投诉应对", "风险合规"]),
      timeLimit: 30,
      roundLimit: 20,
      allowRetry: true,
      showHints: false,
      reportVisibleMode: "mentor_review",
      createdById: mentor.id
    }
  });

  await prisma.faqDocument.upsert({
    where: { id: "coat-default-faq" },
    update: {
      title: "女士休闲外套默认FAQ",
      content: `${coat.faqText}\n${coat.policyText}`,
      productId: coat.id,
      uploadedById: mentor.id
    },
    create: {
      id: "coat-default-faq",
      title: "女士休闲外套默认FAQ",
      content: `${coat.faqText}\n${coat.policyText}`,
      productId: coat.id,
      uploadedById: mentor.id
    }
  });

  await prisma.faqDocument.upsert({
    where: { id: "earphone-default-faq" },
    update: {
      title: "蓝牙耳机默认FAQ",
      content: `${earphone.faqText}\n${earphone.policyText}`,
      productId: earphone.id,
      uploadedById: mentor.id
    },
    create: {
      id: "earphone-default-faq",
      title: "蓝牙耳机默认FAQ",
      content: `${earphone.faqText}\n${earphone.policyText}`,
      productId: earphone.id,
      uploadedById: mentor.id
    }
  });

  for (const task of [sampleTask, hardTask, finalTask]) {
    await prisma.taskEnrollment.upsert({
      where: {
        taskId_userId: {
          taskId: task.id,
          userId: student.id
        }
      },
      update: {
        assignedById: mentor.id
      },
      create: {
        taskId: task.id,
        userId: student.id,
        assignedById: mentor.id
      }
    });
  }

  await prisma.aiProvider.upsert({
    where: { id: "deepseek-default" },
    update: {
      name: "DeepSeek 默认模型",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      isActive: true
    },
    create: {
      id: "deepseek-default",
      name: "DeepSeek 默认模型",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      isActive: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
