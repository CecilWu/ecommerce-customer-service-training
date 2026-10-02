import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apprenticeVisibleReportWhere } from "@/lib/report-access";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const where: Prisma.ScoreReportWhereInput | undefined =
    user.role === "APPRENTICE"
      ? apprenticeVisibleReportWhere(user.id)
      : user.role === "MASTER"
        ? { session: { task: { createdById: user.id } } }
        : undefined;

  const reports = await prisma.scoreReport.findMany({
    where,
    include: {
      session: {
        include: {
          user: true,
          task: { include: { product: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return NextResponse.json({ reports });
}
