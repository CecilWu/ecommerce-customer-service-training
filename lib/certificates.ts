import type { Prisma } from "@prisma/client";

export async function syncCertificateForExamAttempt(
  tx: Prisma.TransactionClient,
  input: { userId: string; finalScore: number; level: string; issuedAt: Date }
) {
  const existing = await tx.certificate.findFirst({ where: { userId: input.userId } });

  if (input.finalScore < 80) {
    if (existing) await tx.certificate.delete({ where: { id: existing.id } });
    return;
  }

  if (existing) {
    await tx.certificate.update({
      where: { id: existing.id },
      data: { finalScore: input.finalScore, level: input.level, issuedAt: input.issuedAt }
    });
    return;
  }

  await tx.certificate.create({
    data: {
      userId: input.userId,
      certificateNo: `ECS-${input.issuedAt.getFullYear()}-${input.userId.slice(-6).toUpperCase()}`,
      title: "电商客服岗位实训出师证书",
      level: input.level,
      finalScore: input.finalScore,
      issuedAt: input.issuedAt
    }
  });
}
