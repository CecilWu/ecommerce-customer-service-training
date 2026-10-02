import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

try {
  const integrity = await prisma.$queryRawUnsafe("PRAGMA integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    fail(`SQLite 完整性检查失败：${JSON.stringify(integrity)}`);
  }

  const foreignKeys = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  if (foreignKeys.length) fail(`发现 ${foreignKeys.length} 条外键异常`);

  const [users, units, tasks, enrollments, sessions, providers] = await Promise.all([
    prisma.user.findMany({ select: { id: true, username: true, role: true, isActive: true, organizationUnitId: true } }),
    prisma.organizationUnit.findMany({ select: { id: true, name: true, isActive: true, owner: { select: { role: true, username: true } } } }),
    prisma.task.findMany({ select: { id: true, title: true, type: true, createdById: true, organizationUnitId: true, isArchived: true } }),
    prisma.taskEnrollment.findMany({ select: { taskId: true, userId: true, task: { select: { organizationUnitId: true } }, user: { select: { username: true, role: true, organizationUnitId: true } } } }),
    prisma.trainingSession.findMany({ select: { id: true, status: true, user: { select: { username: true, role: true } }, report: { select: { totalScore: true } } } }),
    prisma.aiProvider.findMany({ select: { name: true, isActive: true, apiKeyEncrypted: true } })
  ]);

  for (const user of users) {
    if ((user.role === "ADMIN" || user.role === "MASTER") && user.organizationUnitId) {
      fail(`${user.username} 的角色为 ${user.role}，不应归属班级/部门`);
    }
    if (user.role === "APPRENTICE" && user.isActive && !user.organizationUnitId) {
      warn(`启用中的徒弟 ${user.username} 尚未归属班级/部门`);
    }
  }

  for (const unit of units) {
    if (!unit.owner) warn(`班级/部门“${unit.name}”尚未绑定师父`);
    else if (unit.owner.role !== "MASTER") fail(`班级/部门“${unit.name}”的创建者 ${unit.owner.username} 不是师父`);
    if (!unit.isActive) warn(`班级/部门“${unit.name}”当前处于停用状态`);
  }

  for (const task of tasks) {
    if (!task.createdById) warn(`任务“${task.title}”缺少创建师父`);
    if (!task.organizationUnitId && !task.isArchived) warn(`未归档任务“${task.title}”尚未绑定班级/部门`);
    if (task.type === "EXAM" && task.isArchived) warn(`正式出师考核“${task.title}”已归档`);
  }

  for (const enrollment of enrollments) {
    if (enrollment.user.role !== "APPRENTICE") fail(`任务加入记录包含非徒弟账号 ${enrollment.user.username}`);
    if (enrollment.task.organizationUnitId && enrollment.task.organizationUnitId !== enrollment.user.organizationUnitId) {
      fail(`徒弟 ${enrollment.user.username} 的任务加入记录与班级/部门不一致`);
    }
  }

  for (const session of sessions) {
    if (session.user.role !== "APPRENTICE") fail(`训练会话 ${session.id} 的用户 ${session.user.username} 不是徒弟`);
    if (session.status === "RUNNING" && session.report) fail(`进行中的训练会话 ${session.id} 已存在评分报告`);
    if (session.status !== "RUNNING" && !session.report) fail(`已提交训练会话 ${session.id} 缺少评分报告`);
    if (session.report && (session.report.totalScore < 0 || session.report.totalScore > 100)) {
      fail(`训练会话 ${session.id} 的总分超出 0-100 范围`);
    }
  }

  const activeProviders = providers.filter((provider) => provider.isActive);
  if (activeProviders.length > 1) fail(`同时启用了 ${activeProviders.length} 个 AI 模型`);
  if (!activeProviders.length) warn("当前没有启用的 AI 模型，训练将无法调用真实大模型");
  if (activeProviders.some((provider) => !provider.apiKeyEncrypted)) fail("已启用的 AI 模型缺少 API Key");

  console.log(`数据库完整性检查完成：${users.length} 个账号、${units.length} 个班级/部门、${tasks.length} 个任务、${sessions.length} 次训练会话。`);
  for (const message of warnings) console.warn(`提示：${message}`);
  if (errors.length) {
    console.error("发现阻断上线的数据问题：");
    for (const message of errors) console.error(`- ${message}`);
    process.exitCode = 1;
  } else {
    console.log("未发现阻断上线的数据一致性问题。");
  }
} finally {
  await prisma.$disconnect();
}
