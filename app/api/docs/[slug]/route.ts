import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readResearchDoc } from "@/lib/docs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  await requireUser(["MASTER", "ADMIN"]);

  const { slug } = await params;
  const result = await readResearchDoc(slug);
  if (!result) return NextResponse.json({ error: "文档不存在" }, { status: 404 });

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  return new NextResponse(result.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(result.doc.fileName)}`
    }
  });
}
