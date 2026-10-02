"use client";

import Link from "next/link";
import { useState } from "react";
import { FilePlus2, ListChecks, Save, Sparkles, UploadCloud } from "lucide-react";

type ProductOption = {
  id: string;
  name: string;
  category: string;
  description: string;
};

type OrgUnitOption = {
  id: string;
  name: string;
};

type TaskDraft = {
  id: string;
  title: string;
  type: string;
  difficulty: string;
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
  organizationUnitId: string;
  objectives: string;
  timeLimit: number;
  roundLimit: number;
  allowRetry: boolean;
  allowMakeupExam: boolean;
  showHints: boolean;
  reportVisibleMode: string;
};

const typeText: Record<string, string> = {
  daily: "日常训练",
  assessment: "阶段测评",
  exam: "正式出师考核"
};

const difficultyText: Record<string, string> = {
  easy: "简单：真实克制",
  medium: "中等：明显不满",
  hard: "困难：高压复杂争议"
};

export function NewTaskForm({
  products,
  orgUnits,
  task
}: {
  products: ProductOption[];
  orgUnits: OrgUnitOption[];
  task?: TaskDraft;
}) {
  const isEditing = Boolean(task);
  const [scenario, setScenario] = useState(task?.scenario ?? "客户收到商品后发现实物与页面描述存在差异，已多次咨询仍未得到明确处理，现要求客服核实订单、判断问题责任并给出可执行的售后方案与时效。");
  const [customerProfile, setCustomerProfile] = useState(task?.customerProfile ?? "客户有网购经验，当前明显不满，担心商家推诿；愿意提供订单及图片凭证，但会持续追问责任、赔偿依据和处理进度。");
  const [objectives, setObjectives] = useState(task?.objectives ?? "情绪安抚；信息核实；退换货规则解释；处理方案闭环；不合理诉求拒绝。");
  const [productId, setProductId] = useState(task?.productId ?? products[0]?.id ?? "");
  const [type, setType] = useState(task?.type.toLowerCase() ?? "daily");
  const [difficulty, setDifficulty] = useState(task?.difficulty.toLowerCase() ?? "medium");
  const [selectedUnit, setSelectedUnit] = useState(task?.organizationUnitId ?? orgUnits[0]?.id ?? "");
  const [assistStatus, setAssistStatus] = useState("");
  const [isAssisting, setIsAssisting] = useState(false);

  const product = products.find((item) => item.id === productId) ?? products[0];

  async function requestAssist() {
    setIsAssisting(true);
    setAssistStatus("AI正在补充任务单...");
    try {
      const response = await fetch("/api/tasks/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          objectives,
          productName: product?.name,
          productDescription: product?.description,
          difficulty: difficultyText[difficulty],
          type: typeText[type]
        })
      });
      const data = (await response.json()) as { scenario?: string; objectives?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "AI辅助生成失败");
      setScenario((data.scenario || scenario).slice(0, 500));
      setObjectives((data.objectives || objectives).slice(0, 160));
      setAssistStatus("AI已补充，发布前请师父再审核一次。");
    } catch (error) {
      setAssistStatus(error instanceof Error ? error.message : "AI辅助生成失败，请稍后重试。");
    } finally {
      setIsAssisting(false);
    }
  }

  return (
    <form className="stack" action="/api/tasks" method="post">
      {isEditing ? <input type="hidden" name="action" value="update" /> : null}
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
      <div className="section-title">
        <ListChecks size={22} />
        <div>
          <h2>基础信息</h2>
          <p>决定徒弟看到的任务目标和AI客户的压力强度。</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>任务名称</span>
          <input className="input" name="title" defaultValue={task?.title ?? "尺码不符引发的退换货投诉"} />
        </label>
        <label className="field">
          <span>任务类型</span>
          <select className="select" name="type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="daily">日常训练</option>
            <option value="assessment">阶段测评</option>
            <option value="exam">正式出师考核</option>
          </select>
        </label>
        <label className="field">
          <span>训练难度</span>
          <select className="select" name="difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="easy">简单：真实克制</option>
            <option value="medium">中等：明显不满</option>
            <option value="hard">困难：高压复杂争议</option>
          </select>
        </label>
        <label className="field">
          <span>产品资料</span>
          <select className="select" name="productId" value={productId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.category} · {item.name}
              </option>
            ))}
          </select>
          <small className="field-hint">
            没有合适产品时，可先进入
            <Link href="/mentor/products" style={{ color: "var(--blue)", fontWeight: 900 }}>
              产品资料库
            </Link>
            添加。
          </small>
        </label>
        <label className="field">
          <span>时间限制</span>
          <input className="input" name="timeLimit" type="number" min="1" max="180" defaultValue={task?.timeLimit ?? 15} />
        </label>
        <label className="field">
          <span>轮次限制</span>
          <input className="input" name="roundLimit" type="number" min="1" max="50" defaultValue={task?.roundLimit ?? 12} />
        </label>
      </div>

      <section className="flat-card stack">
        <div className="section-title">
          <FilePlus2 size={20} />
          <div>
            <h2>订单与客户资料</h2>
            <p>为AI客户提供可追问、可核实的真实订单事实，徒弟进入实训前也能看到这些信息。</p>
          </div>
        </div>
        <div className="form-grid task-order-grid">
          <label className="field"><span>订单编号</span><input className="input" name="orderNo" defaultValue={task?.orderInfo.orderNo ?? "TB20260711001"} maxLength={40} required /></label>
          <label className="field"><span>下单/签收时间</span><input className="input" name="placedAt" defaultValue={task?.orderInfo.placedAt ?? "2026-07-08 下单，2026-07-10 签收"} maxLength={80} required /></label>
          <label className="field"><span>实付金额</span><input className="input" name="amount" defaultValue={task?.orderInfo.amount ?? "¥299.00"} maxLength={30} required /></label>
          <label className="field"><span>购买数量</span><input className="input" name="quantity" defaultValue={task?.orderInfo.quantity ?? "1件"} maxLength={30} required /></label>
          <label className="field"><span>商品规格</span><input className="input" name="variant" defaultValue={task?.orderInfo.variant ?? "浅灰色 / L码"} maxLength={80} required /></label>
          <label className="field"><span>物流与签收状态</span><input className="input" name="logisticsStatus" defaultValue={task?.orderInfo.logisticsStatus ?? "本人签收，外包装完好"} maxLength={100} required /></label>
        </div>
        <label className="field"><span>现有凭证</span><input className="input" name="evidenceStatus" defaultValue={task?.orderInfo.evidenceStatus ?? "客户可提供订单截图、商品实拍图，暂无完整开箱视频"} maxLength={160} required /></label>
        <label className="field"><span>客户画像</span><textarea className="textarea" name="customerProfile" maxLength={300} value={customerProfile} onChange={(event) => setCustomerProfile(event.target.value)} /></label>
      </section>

      <label className="field">
        <span>任务情境</span>
        <div className="assist-field">
          <textarea className="textarea" name="scenario" maxLength={500} value={scenario} onChange={(event) => setScenario(event.target.value)} />
          <button className="assist-button" type="button" onClick={requestAssist} disabled={isAssisting} aria-label="AI辅助补充任务情境和能力目标">
            <Sparkles size={18} />
          </button>
        </div>
        <small className="field-hint">{scenario.length}/500字，写清事件经过、争议焦点、客户诉求、客服需要完成的工作和合规边界。</small>
      </label>

      <label className="field">
        <span>能力目标</span>
        <div className="assist-field">
          <textarea className="textarea" name="objectives" maxLength={100} value={objectives} onChange={(event) => setObjectives(event.target.value)} />
          <button className="assist-button" type="button" onClick={requestAssist} disabled={isAssisting} aria-label="AI辅助补充能力目标">
            <Sparkles size={18} />
          </button>
        </div>
        <small className="field-hint">{objectives.length}/100字，建议5项以内，用中文分号隔开。</small>
      </label>
      {assistStatus ? <p className={`assist-status ${assistStatus.includes("失败") || assistStatus.includes("认证") ? "error" : ""}`}>{assistStatus}</p> : null}

      <section className="flat-card">
        <div className="section-title">
          <ListChecks size={20} />
          <div>
            <h2>接收任务的班级/部门</h2>
            <p>一个任务对应一个班级/部门；选择后，该班级/部门下的全部徒弟都会收到任务。</p>
          </div>
        </div>
        <label className="field">
          <span>班级/部门</span>
          <select className="select" name="organizationUnitId" value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value)} required>
            <option value="" disabled>请选择班级/部门</option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        {!orgUnits.length ? <p className="muted">请先创建班级/部门，再发布任务。</p> : null}
      </section>

      <section className="flat-card">
          <div className="section-title">
            <FilePlus2 size={20} />
            <div>
              <h2>评分策略</h2>
              <p>默认采用六维四阶模型，可按考试权重微调。</p>
            </div>
          </div>
          <div className="task-policy-grid">
          <label className="field">
            <span>报告可见规则</span>
            <select className="select" name="reportVisibleMode" defaultValue={task?.reportVisibleMode ?? "immediately"}>
              <option value="immediately">训练后立即可见</option>
              <option value="mentor_review">师父审核后可见</option>
            </select>
          </label>
          {type === "exam" ? (
            <label className="field">
              <span>是否允许补考</span>
              <select className="select" name="allowMakeupExam" defaultValue={task?.allowMakeupExam === false ? "no" : "yes"}>
                <option value="yes">允许（默认）</option>
                <option value="no">不允许，提交评分后不可再次参加</option>
              </select>
              <small className="field-hint">正式出师考核使用独立补考规则；每次提交都形成独立报告，最后一次成绩为当前有效成绩。</small>
            </label>
          ) : (
            <label className="field">
              <span>是否允许重复训练</span>
              <select className="select" name="allowRetry" defaultValue={task?.allowRetry === false ? "no" : "yes"}>
                <option value="yes">允许（默认）</option>
                <option value="no">不允许，提交评分后不可再次训练</option>
              </select>
              <small className="field-hint">中途退出且未提交评分不计入训练次数，也不影响是否可再次开始。</small>
            </label>
          )}
          <label className="field">
            <span>是否显示辅助话术</span>
            <select className="select" name="showHints" defaultValue={task?.showHints === false ? "no" : "yes"}>
              <option value="yes">显示</option>
              <option value="no">不显示</option>
            </select>
          </label>
          </div>
      </section>

      <section className="flat-card task-faq-reference">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <UploadCloud size={20} />
          <div>
            <h2>企业FAQ参考</h2>
            <p>任务自动引用所选产品资料与企业FAQ，作为AI判断依据，不向徒弟泄露标准答案。</p>
          </div>
        </div>
        <div className="row" style={{ marginLeft: "auto", flexWrap: "wrap" }}>
          <span className="badge blue">产品FAQ自动关联</span>
          <Link className="button secondary nowrap-button" href="/mentor/faq">管理企业FAQ</Link>
        </div>
      </section>

      <div className="spread">
        <Link className="button secondary nowrap-button" href={task ? `/mentor/tasks/${task.id}` : "/mentor/tasks"}>
          {isEditing ? "返回任务详情" : "取消"}
        </Link>
        <button className="button primary nowrap-button" type="submit">
          <Save size={17} />
          {isEditing ? "保存修改" : "发布任务"}
        </button>
      </div>
    </form>
  );
}
