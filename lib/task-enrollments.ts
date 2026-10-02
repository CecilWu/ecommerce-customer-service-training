import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Keep the derived task enrollment rows aligned with an apprentice's class/department.
 * A class task belongs to every active apprentice in that class; enrollment rows are
 * an execution index, not an independently editable source of truth.
 */
export async function syncApprenticeTaskEnrollments(
  tx: TransactionClient,
  userId: string,
  organizationUnitId: string | null,
  isActive = true
) {
  await tx.taskEnrollment.deleteMany({ where: { userId } });

  if (!organizationUnitId || !isActive) return;

  const tasks = await tx.task.findMany({
    where: { organizationUnitId, isArchived: false },
    select: { id: true, createdById: true }
  });

  for (const task of tasks) {
    await tx.taskEnrollment.create({
      data: {
        taskId: task.id,
        userId,
        assignedById: task.createdById
      }
    });
  }
}
