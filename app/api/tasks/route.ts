import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";
import { toDbDifficulty, toDbTaskType } from "@/lib/mappers";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MASTER") {
    return NextResponse.json({ error: "无权限发布任务" }, { status: 403 });
  }

  const formData = await request.formData();
  const action = String(formData.get("action") || "create").trim();

  if (action === "delete-empty") {
    const taskId = String(formData.get("taskId") || "").trim();
    if (!taskId) return NextResponse.json({ error: "缺少任务ID" }, { status: 400 });
    const task = await prisma.task.findFirst({ where: { id: taskId, createdById: user.id, isArchived: false } });
    if (!task) return NextResponse.json({ error: "任务不存在或不属于当前师父" }, { status: 404 });
    const sessionCount = await prisma.trainingSession.count({ where: { taskId: task.id } });
    if (sessionCount > 0) {
      return NextResponse.json({ error: "任务已有徒弟训练记录，为保留教学证据只能归档，不能直接删除" }, { status: 409 });
    }
    await prisma.task.delete({ where: { id: task.id } });
    return NextResponse.redirect(requestUrl(request, "/mentor/tasks?task=deleted"), { status: 303 });
  }

  if (action === "archive") {
    const taskId = String(formData.get("taskId") || "").trim();
    const confirmDelete = String(formData.get("confirmDelete") || "").trim();
    if (!taskId) return NextResponse.json({ error: "缺少任务ID" }, { status: 400 });
    if (confirmDelete !== "删除任务") {
      return NextResponse.json({ error: "请输入“删除任务”确认归档" }, { status: 400 });
    }

    const task = await prisma.task.findFirst({ where: { id: taskId, createdById: user.id } });
    if (!task) return NextResponse.json({ error: "任务不存在或不属于当前师父" }, { status: 404 });
    await prisma.task.update({
      where: { id: task.id },
      data: { isArchived: true, archivedAt: new Date() }
    });
    return NextResponse.redirect(requestUrl(request, "/mentor/tasks?task=archived"), { status: 303 });
  }

  const title = String(formData.get("title") || "").trim();
  const productId = String(formData.get("productId") || "").trim();
  const scenario = String(formData.get("scenario") || "").trim();
  const customerProfile = String(formData.get("customerProfile") || "").trim();
  const organizationUnitId = String(formData.get("organizationUnitId") || "").trim();
  const objectivesRaw = String(formData.get("objectives") || "").trim();
  const type = String(formData.get("type") || "daily");
  const difficulty = String(formData.get("difficulty") || "medium");

  if (!title || !productId || !scenario || !organizationUnitId) {
    return NextResponse.json({ error: "任务名称、产品、情境和班级/部门不能为空" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      OR: [{ createdById: null }, { createdById: user.id }]
    },
    select: { id: true }
  });
  if (!product) {
    return NextResponse.json({ error: "产品资料不存在，请重新选择" }, { status: 400 });
  }

  const organizationUnit = await prisma.organizationUnit.findFirst({
    where: { id: organizationUnitId, ownerId: user.id, isActive: true },
    select: { id: true }
  });
  if (!organizationUnit) {
    return NextResponse.json({ error: "班级/部门不存在、已停用或不属于当前师父" }, { status: 400 });
  }

  const objectives = objectivesRaw.split(/[;；,\n]/).map((item) => item.trim()).filter(Boolean);
  const timeLimit = Number.parseInt(String(formData.get("timeLimit") || "15"), 10);
  const roundLimit = Number.parseInt(String(formData.get("roundLimit") || "12"), 10);
  if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 180) {
    return NextResponse.json({ error: "时间限制必须为1至180分钟" }, { status: 400 });
  }
  if (!Number.isInteger(roundLimit) || roundLimit < 1 || roundLimit > 50) {
    return NextResponse.json({ error: "轮次限制必须为1至50轮" }, { status: 400 });
  }
  const dbTaskType = toDbTaskType(type);
  const isExam = dbTaskType === "EXAM";

  const validApprentices = await prisma.user.findMany({
    where: { role: "APPRENTICE", isActive: true, organizationUnitId: organizationUnit.id },
    select: { id: true }
  });

  const orderInfoJson = JSON.stringify({
    orderNo: String(formData.get("orderNo") || "").trim(),
    placedAt: String(formData.get("placedAt") || "").trim(),
    amount: String(formData.get("amount") || "").trim(),
    quantity: String(formData.get("quantity") || "").trim(),
    variant: String(formData.get("variant") || "").trim(),
    logisticsStatus: String(formData.get("logisticsStatus") || "").trim(),
    evidenceStatus: String(formData.get("evidenceStatus") || "").trim()
  });

  const taskData = {
    title,
    type: dbTaskType,
    productId,
    scenario,
    customerProfile,
    orderInfoJson,
    organizationUnitId: organizationUnit.id,
    difficulty: toDbDifficulty(difficulty),
    objectivesJson: JSON.stringify(objectives.length ? objectives : ["客户接待", "问题处理", "服务闭环"]),
    timeLimit,
    roundLimit,
    allowRetry: isExam ? true : String(formData.get("allowRetry") || "yes") === "yes",
    allowMakeupExam: isExam ? String(formData.get("allowMakeupExam") || "yes") === "yes" : true,
    showHints: String(formData.get("showHints") || "yes") === "yes",
    reportVisibleMode: String(formData.get("reportVisibleMode") || "immediately")
  };

  if (action === "update") {
    const taskId = String(formData.get("taskId") || "").trim();
    const existingTask = await prisma.task.findFirst({ where: { id: taskId, createdById: user.id, isArchived: false } });
    if (!existingTask) return NextResponse.json({ error: "任务不存在、已归档或不属于当前师父" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: existingTask.id }, data: taskData });
      await tx.taskEnrollment.deleteMany({ where: { taskId: existingTask.id } });
      if (validApprentices.length) {
        await tx.taskEnrollment.createMany({
          data: validApprentices.map((apprentice) => ({ taskId: existingTask.id, userId: apprentice.id, assignedById: user.id }))
        });
      }
    });
    return NextResponse.redirect(requestUrl(request, `/mentor/tasks/${existingTask.id}?task=updated`), { status: 303 });
  }

  if (action !== "create") return NextResponse.json({ error: "未知任务操作" }, { status: 400 });

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({ data: { ...taskData, createdById: user.id } });
    if (validApprentices.length) {
      await tx.taskEnrollment.createMany({
        data: validApprentices.map((apprentice) => ({ taskId: created.id, userId: apprentice.id, assignedById: user.id }))
      });
    }
    return created;
  });

  return NextResponse.redirect(requestUrl(request, `/mentor/tasks?task=created&id=${task.id}`), { status: 303 });
}
