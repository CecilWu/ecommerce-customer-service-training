import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ready",
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt
      },
      { status: 503 }
    );
  }
}
