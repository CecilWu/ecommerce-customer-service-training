import type { DimensionScore, ScoreReport } from "./types";

export type ReportLike = {
  totalScore: number;
  level: string;
  reportJson: string;
};

export type RadarDimension = {
  name: string;
  shortName: string;
  score: number;
  maxScore: number;
  percent: number;
};

const shortNameMap: Record<string, string> = {
  客户问题洞察力: "问题洞察",
  情绪调节与信任修复力: "情绪信任",
  产品规则与证据应用力: "规则证据",
  服务恢复方案设计力: "恢复方案",
  流程规范与风险治理力: "流程风控",
  职业表达与成长迁移力: "职业表达"
};

export function parseScoreReport(reportJson: string): ScoreReport | null {
  try {
    const report = JSON.parse(reportJson) as ScoreReport;
    if (!Array.isArray(report.dimensions)) return null;
    return report;
  } catch {
    return null;
  }
}

export function aggregateRadarDimensions(reports: ReportLike[]): RadarDimension[] {
  const buckets = new Map<string, { score: number; maxScore: number; count: number; sample: DimensionScore }>();

  for (const record of reports) {
    const report = parseScoreReport(record.reportJson);
    if (!report) continue;
    for (const dimension of report.dimensions) {
      const current = buckets.get(dimension.name) ?? { score: 0, maxScore: 0, count: 0, sample: dimension };
      current.score += dimension.score;
      current.maxScore += dimension.maxScore;
      current.count += 1;
      current.sample = dimension;
      buckets.set(dimension.name, current);
    }
  }

  return Array.from(buckets.entries()).map(([name, item]) => {
    const score = item.count ? item.score / item.count : 0;
    const maxScore = item.count ? item.maxScore / item.count : item.sample.maxScore;
    return {
      name,
      shortName: shortNameMap[name] ?? name.slice(0, 4),
      score,
      maxScore,
      percent: maxScore ? Math.round((score / maxScore) * 100) : 0
    };
  });
}

export function collectWeakTags(reports: ReportLike[], limit = 4) {
  const counts = new Map<string, number>();
  for (const record of reports) {
    const report = parseScoreReport(record.reportJson);
    for (const tag of report?.skillTags?.weak ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function averageScore(reports: ReportLike[]) {
  if (!reports.length) return null;
  return Math.round(reports.reduce((sum, report) => sum + report.totalScore, 0) / reports.length);
}
