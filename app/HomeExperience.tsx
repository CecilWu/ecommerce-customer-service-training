"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardList,
  MessageSquareWarning,
  Radar,
  ShieldCheck,
  Sparkles,
  Trophy
} from "lucide-react";

const pageLabels = ["开场", "AI客户", "师父带教", "评价出师", "开始使用"];

const assistantHints = ["先安抚情绪", "核实订单事实", "给出规则依据", "明确处理闭环"];

export function HomeExperience() {
  const [activePage, setActivePage] = useState(0);
  const activePageRef = useRef(0);
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);
  const pagesRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  useEffect(() => {
    function syncHomeViewport() {
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const topbarHeight = Math.ceil(topbar?.getBoundingClientRect().height ?? 80);
      document.documentElement.style.setProperty("--home-topbar-height", `${topbarHeight}px`);
    }

    syncHomeViewport();
    window.addEventListener("resize", syncHomeViewport);
    window.visualViewport?.addEventListener("resize", syncHomeViewport);

    return () => {
      window.removeEventListener("resize", syncHomeViewport);
      window.visualViewport?.removeEventListener("resize", syncHomeViewport);
    };
  }, []);

  const registerPage = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      pagesRef.current[index] = node;
    },
    []
  );

  const goToPage = useCallback((index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, pageLabels.length - 1));
    const pager = pagerRef.current;
    const page = pagesRef.current[boundedIndex];
    if (!pager || !page) return;

    pagingRef.current = true;
    activePageRef.current = boundedIndex;
    setActivePage(boundedIndex);
    pager.scrollTo({ top: boundedIndex * pager.clientHeight, behavior: "smooth" });

    window.setTimeout(() => {
      pagingRef.current = false;
    }, 980);
  }, []);

  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.pageIndex ?? "0");
        activePageRef.current = index;
        setActivePage(index);
      },
      { root: pager, threshold: [0.55, 0.72, 0.9] }
    );

    pagesRef.current.forEach((page) => {
      if (page) observer.observe(page);
    });

    function handleWheel(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) < 14 || pagingRef.current) return;

      const current = activePageRef.current;
      const next = event.deltaY > 0 ? current + 1 : current - 1;
      if (next < 0 || next >= pageLabels.length) return;

      event.preventDefault();
      goToPage(next);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button, input, textarea, select")) return;

      if (["ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goToPage(activePageRef.current + 1);
      }
      if (["ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goToPage(activePageRef.current - 1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        goToPage(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goToPage(pageLabels.length - 1);
      }
    }

    pager.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      observer.disconnect();
      pager.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goToPage]);

  useEffect(() => {
    function keepActivePageAligned() {
      const pager = pagerRef.current;
      if (!pager) return;
      pager.scrollTo({ top: activePageRef.current * pager.clientHeight, behavior: "auto" });
    }

    window.addEventListener("resize", keepActivePageAligned);
    window.visualViewport?.addEventListener("resize", keepActivePageAligned);

    return () => {
      window.removeEventListener("resize", keepActivePageAligned);
      window.visualViewport?.removeEventListener("resize", keepActivePageAligned);
    };
  }, []);

  const nextPage = activePage >= pageLabels.length - 1 ? 0 : activePage + 1;
  const nextPageLabel = activePage >= pageLabels.length - 1 ? "回到第一屏" : "切换到下一屏";
  const pageClass = (index: number) => `home-page premium-section ${activePage === index ? "is-active" : activePage > index ? "is-before" : "is-after"}`;

  return (
    <div className="home-pager premium-home" ref={pagerRef}>
      <nav className="home-page-nav premium-page-nav" aria-label="首页分屏导航">
        {pageLabels.map((label, index) => (
          <button
            aria-label={`切换到${label}`}
            aria-current={activePage === index ? "page" : undefined}
            className={activePage === index ? "active" : ""}
            key={label}
            onClick={() => goToPage(index)}
            type="button"
          >
            <span>{index + 1}</span>
          </button>
        ))}
      </nav>

      <button aria-label={nextPageLabel} className="scroll-cue premium-scroll-cue" onClick={() => goToPage(nextPage)} type="button">
        {activePage >= pageLabels.length - 1 ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
      </button>

      <section className={`premium-hero ${pageClass(0)}`} data-page-index="0" ref={registerPage(0)}>
        <div className="premium-bg command" aria-hidden="true" />
        <div className="premium-vignette" aria-hidden="true" />
        <div className="premium-copy premium-hero-copy">
          <span className="premium-eyebrow">中职电子商务专业 · 企业岗位实训</span>
          <h1>
            把真实客服岗位，
            <br />
            搬进AI实训现场。
          </h1>
          <p>师父发布企业化任务，徒弟直面高压客户。每一次接待都沉淀为可追踪、可诊断、可认证的岗位能力证据。</p>
          <div className="premium-actions">
            <Link className="button primary premium-cta" href="/mentor">
              进入师父工作台
              <ArrowRight size={18} />
            </Link>
            <Link className="button secondary premium-cta light" href="/apprentice">
              进入徒弟训练台
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="premium-float-stack" aria-hidden="true">
          <article className="premium-glass-card pressure">
            <span>AI客户压力</span>
            <strong>“我要投诉，你们必须解决。”</strong>
          </article>
          <article className="premium-glass-card protocol">
            <span>客服策略</span>
            <strong>安抚 · 核实 · 闭环</strong>
          </article>
        </div>

        <div className="premium-kpis" aria-label="平台关键能力">
          <div>
            <strong>3档</strong>
            <span>客户压力</span>
          </div>
          <div>
            <strong>6维</strong>
            <span>企业质检</span>
          </div>
          <div>
            <strong>1证</strong>
            <span>出师认证</span>
          </div>
        </div>
      </section>

      <section className={`premium-ai ${pageClass(1)}`} data-page-index="1" ref={registerPage(1)}>
        <div className="premium-bg command dim" aria-hidden="true" />
        <div className="premium-vignette deep" aria-hidden="true" />
        <div className="premium-copy">
          <span className="premium-eyebrow">AI极端客户</span>
          <h2>学生面对的是一位会极端施压的AI客户。</h2>
          <p>投诉、差评、退款、补偿、质疑流程。AI客户会根据徒弟回复继续追问，让课堂训练更接近企业真实岗位。</p>
        </div>
        <div className="premium-sim-panel" aria-label="AI客户对话演示">
          <div className="premium-ring" />
          <article className="premium-chat angry">
            <MessageSquareWarning size={20} />
            <span>“你们到底能不能解决？我要投诉。”</span>
          </article>
          <article className="premium-chat calm">
            <ShieldCheck size={20} />
            <span>先安抚，再核实，最后闭环。</span>
          </article>
          <div className="premium-hints">
            {assistantHints.map((hint) => (
              <span key={hint}>{hint}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={`premium-stage ${pageClass(2)}`} data-page-index="2" ref={registerPage(2)}>
        <div className="premium-bg stage" aria-hidden="true" />
        <div className="premium-stage-copy">
          <span className="premium-eyebrow">师父工作台</span>
          <h2>
            从发布任务到查看诊断，
            <br />
            带教过程全程系统化。
          </h2>
          <p>师父管理自己的任务、徒弟和报告。FAQ只作为知识参考，让企业规则进入训练，却不变成学生照抄的答案。</p>
        </div>
        <div className="premium-console" aria-label="师父工作台运行概览">
          <div className="premium-console-head">
            <span>智能训练运行中</span>
            <strong>85.0</strong>
          </div>
          <div className="premium-progress">
            <span style={{ width: "82%" }} />
          </div>
          <div className="premium-console-grid">
            <div>
              <strong>12</strong>
              <span>训练记录</span>
            </div>
            <div>
              <strong>4</strong>
              <span>待师父审核</span>
            </div>
            <div>
              <strong>0</strong>
              <span>重大风险话术</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`premium-certificate ${pageClass(3)}`} data-page-index="3" ref={registerPage(3)}>
        <div className="premium-bg certificate" aria-hidden="true" />
        <div className="premium-copy">
          <span className="premium-eyebrow">评价与出师</span>
          <h2>
            成绩不是一个分数，
            <br />
            而是一份诊改报告。
          </h2>
          <p>六维评价、风险封顶、证据链诊断自动生成反馈，让徒弟知道哪里做得好，哪里要重练，下一次该怎么说。</p>
        </div>
        <div className="premium-certificate-stage">
          <div className="premium-cert-paper">
            <BadgeCheck size={36} />
            <h3>出师证书</h3>
            <p>岗位接待 · 售后处理 · 投诉应对</p>
            <div className="premium-cert-line" />
            <strong>优秀</strong>
          </div>
          <div className="premium-diagnostic-strip">
            <span>
              <Radar size={17} />
              六维雷达
            </span>
            <span>
              <BarChart3 size={17} />
              诊改建议
            </span>
            <span>
              <Trophy size={17} />
              出师认证
            </span>
          </div>
          <Link className="button secondary premium-verify-link" href="/certificate/verify">
            <BadgeCheck size={18} />
            公开核验证书
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className={`premium-final ${pageClass(4)}`} data-page-index="4" ref={registerPage(4)}>
        <div className="premium-final-glow" aria-hidden="true" />
        <div className="premium-final-content">
          <BookOpenCheck size={34} />
          <h2>训练、诊断、考核、证书</h2>
          <p>闭环的科学训练体系，让学生在反复实战中真正掌握客服应答能力。</p>
          <div className="premium-actions">
            <Link className="button primary premium-cta" href="/mentor">
              师父发布任务
              <ArrowRight size={18} />
            </Link>
            <Link className="button secondary premium-cta light" href="/apprentice">
              徒弟开始实训
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
        <div className="premium-final-modules" aria-hidden="true">
          <span>
            <ClipboardList size={18} />
            任务
          </span>
          <span>
            <BrainCircuit size={18} />
            实训
          </span>
          <span>
            <Sparkles size={18} />
            诊断
          </span>
          <span>
            <BadgeCheck size={18} />
            证书
          </span>
        </div>
        <footer className="home-footer premium-home-footer">
          <span>All Copyright Rights Reserved . Cecil.Wu</span>
          <span>开发者：吴晓波</span>
          <span>版本号：20260707</span>
          <span>网页备案：浙ICP备14009446号</span>
          <span>浙公网安备33042102000238号</span>
        </footer>
      </section>
    </div>
  );
}
