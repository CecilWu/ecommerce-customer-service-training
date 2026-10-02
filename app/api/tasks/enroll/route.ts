import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";
import { canManageTask } from "@/lib/permissions";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MASTER") {
    return NextResponse.json({ error: "无权限分配徒弟" }, { status: 403 });
  }

  const formData = await request.formData();
  const taskId = String(formData.get("taskId") || "").trim();
  const apprenticeId = String(formData.get("apprenticeId") || "").trim();

  const task = await prisma.task.findFirst({ where: { id: taskId, createdById: user.id, isArchived: false } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (!canManageTask(user, task)) {
    return NextResponse.json({ error: "只能管理自己创建的任务" }, { status: 403 });
  }

  const apprentice = await prisma.user.findFirst({
    where: {
      id: apprenticeId,
      role: "APPRENTICE",
      isActive: true,
      organizationUnit: { is: { ownerId: user.id, isActive: true } }
    }
  });
  if (!apprentice) {
    return NextResponse.json({ error: "只能加入自己班级/部门下的启用徒弟账号" }, { status: 400 });
  }

  await prisma.taskEnrollment.upsert({
    where: {
      taskId_userId: {
        taskId,
        userId: apprenticeId
      }
    },
    update: {
      assignedById: user.id
    },
    create: {
      taskId,
      userId: apprenticeId,
      assignedById: user.id
    }
  });

  return NextResponse.redirect(requestUrl(request, "/mentor/tasks?enrollment=created"), { status: 303 });
}
