import { readFile } from "fs/promises";
import path from "path";

export const researchDocs = [
  {
    slug: "product-and-workflow",
    title: "产品与业务说明",
    fileName: "产品与业务说明.md",
    detail: "系统定位、三类角色、训练闭环、页面入口、业务规则和当前边界。"
  },
  {
    slug: "system-architecture",
    title: "系统架构与数据模型",
    fileName: "系统架构与数据模型.md",
    detail: "现行技术架构、认证权限、Prisma 实体、核心接口和数据流。"
  },
  {
    slug: "ai-and-scoring",
    title: "AI 与评分机制",
    fileName: "AI与评分机制.md",
    detail: "模型配置、客户智能体、FAQ 检索、评分结构、风险封顶和本地回退。"
  },
  {
    slug: "development-maintenance",
    title: "开发维护指南",
    fileName: "开发维护指南.md",
    detail: "目录职责、开发流程、修改检查点、数据库变更和维护注意事项。"
  },
  {
    slug: "deployment-operations",
    title: "部署运维指南",
    fileName: "部署运维指南.md",
    detail: "多系统端口隔离、Nginx 反向代理、域名与 SSL、备份和故障排查。"
  },
  {
    slug: "release-checklist",
    title: "测试发布清单",
    fileName: "测试发布清单.md",
    detail: "上线前自动化命令、人工验收、数据与安全检查以及回滚要求。"
  },
  {
    slug: "case-application",
    title: "典型案例申报材料",
    fileName: "典型案例申报材料.md",
    detail: "项目背景、方案创新、应用成效、推广价值和申报填写口径。"
  }
];

export function findResearchDoc(slug: string) {
  return researchDocs.find((doc) => doc.slug === slug);
}

export function researchDocPath(fileName: string) {
  return path.join(process.cwd(), "docs", fileName);
}

export async function readResearchDoc(slug: string) {
  const doc = findResearchDoc(slug);
  if (!doc) return null;
  const content = await readFile(researchDocPath(doc.fileName), "utf8");
  return { doc, content };
}
