import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productFromDb, taskFromDb } from "@/lib/mappers";
import { TrainingClient } from "./TrainingClient";
import { notFound } from "next/navigation";

export default async function TrainingPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser(["APPRENTICE"]);
  const { taskId } = await params;
  const taskRecord = await prisma.task.findFirst({
    where: {
      id: taskId,
      isArchived: false,
      OR: [
        { enrollments: { some: { userId: user.id } } },
        ...(user.organizationUnitId ? [{ organizationUnitId: user.organizationUnitId }] : [])
      ]
    },
    include: { product: true }
  });

  if (!taskRecord) notFound();

  const task = taskFromDb(taskRecord);
  const product = productFromDb(taskRecord.product);

  return (
    <div className="apprentice-immersive-content">
      <section className="wide-container apprentice-training-wrap">
        <TrainingClient task={task} product={product} />
      </section>
    </div>
  );
}
