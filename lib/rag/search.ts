import { prisma } from "@/lib/db";

export type KnowledgeHit = {
  title: string;
  snippet: string;
  score: number;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

function keywords(text: string) {
  const normalized = normalize(text);
  const words = new Set<string>();
  const latin = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  latin.forEach((word) => words.add(word));
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const pair = normalized.slice(index, index + 2);
    if (/[\u4e00-\u9fa5]{2}/.test(pair)) words.add(pair);
  }
  return words;
}

function splitChunks(content: string) {
  return content
    .split(/\n{1,}|。|；|;/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
    .slice(0, 80);
}

function scoreChunk(queryWords: Set<string>, chunk: string) {
  const chunkText = normalize(chunk);
  let score = 0;
  queryWords.forEach((word) => {
    if (chunkText.includes(word)) score += word.length > 2 ? 2 : 1;
  });
  return score;
}

export async function searchKnowledge({
  productId,
  query,
  limit = 5
}: {
  productId?: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const docs = await prisma.faqDocument.findMany({
    where: productId
      ? {
          OR: [{ productId }, { productId: null }]
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 30
  });

  const queryWords = keywords(query);
  const hits = docs.flatMap((doc) =>
    splitChunks(doc.content).map((chunk) => ({
      title: doc.title,
      snippet: chunk,
      score: scoreChunk(queryWords, `${doc.title}${chunk}`)
    }))
  );

  return hits
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatKnowledge(hits: KnowledgeHit[]) {
  if (!hits.length) return "未检索到直接相关FAQ，按任务产品规则和客服规范处理。";
  return hits.map((hit, index) => `${index + 1}. ${hit.title}：${hit.snippet}`).join("\n");
}
