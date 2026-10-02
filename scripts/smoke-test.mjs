import { PrismaClient } from "@prisma/client";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
const prisma = new PrismaClient();
const accounts = [
  { role: "管理员", username: process.env.SMOKE_ADMIN_USERNAME || "admin", password: process.env.SMOKE_ADMIN_PASSWORD || "admin", home: "/admin" },
  { role: "师父", username: process.env.SMOKE_MASTER_USERNAME || "teacher", password: process.env.SMOKE_MASTER_PASSWORD || "teacher", home: "/mentor" },
  { role: "徒弟", username: process.env.SMOKE_APPRENTICE_USERNAME || "student", password: process.env.SMOKE_APPRENTICE_PASSWORD || "student", home: "/apprentice" }
];
const protectedHomes = ["/admin", "/mentor", "/apprentice"];
const documentationPages = [
  "/docs",
  "/docs/product-and-workflow",
  "/docs/system-architecture",
  "/docs/ai-and-scoring",
  "/docs/development-maintenance",
  "/docs/deployment-operations",
  "/docs/release-checklist",
  "/docs/case-application"
];
const rolePages = {
  管理员: [
    "/admin", "/admin/accounts", "/admin/accounts/new", "/admin/tasks",
    "/admin/reports", "/admin/ai", "/admin/ai/new", "/admin/org-units",
    "/admin/permissions", "/admin/password", ...documentationPages
  ],
  师父: [
    "/mentor", "/mentor/tasks", "/mentor/tasks/new", "/mentor/products",
    "/mentor/org-units", "/mentor/faq", "/mentor/reports",
    "/mentor/certificates", "/mentor/exams", "/mentor/signature", "/mentor/password",
    ...documentationPages
  ],
  徒弟: [
    "/apprentice", "/apprentice/tasks", "/apprentice/reports",
    "/apprentice/growth", "/apprentice/exam/final", "/apprentice/certificate",
    "/apprentice/password"
  ]
};
const protectedApiPaths = [
  "/api/account/password", "/api/admin/ai-providers", "/api/admin/org-units",
  "/api/admin/users", "/api/faq", "/api/products", "/api/tasks",
  "/api/training/start", "/api/training/message", "/api/training/score"
];
const failures = [];

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...options });
}

function expectRedirectToLogin(response, label) {
  if (![303, 307, 308].includes(response.status) || !response.headers.get("location")?.includes("/login")) {
    failures.push(`${label} 应跳转登录页，实际状态 ${response.status}`);
  }
}

function expectApiRejected(response, label) {
  if ([401, 403].includes(response.status)) return;
  if ([303, 307, 308].includes(response.status) && response.headers.get("location")?.includes("/login")) return;
  failures.push(`${label} 未被正确拦截，实际状态 ${response.status}`);
}

let adminCookie = "";
let smokeProviderId = "";

try {

for (const path of protectedHomes) {
  const response = await request(path);
  expectRedirectToLogin(response, `未登录访问 ${path}`);
}

for (const path of protectedApiPaths) {
  const response = await request(path, { method: "POST" });
  expectApiRejected(response, `未登录调用 ${path}`);
}

for (const account of accounts) {
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: account.username, password: account.password })
  });
  const cookie = cookieFrom(login);
  if (login.status !== 200 || !cookie) {
    failures.push(`${account.role}账号 ${account.username} 登录失败（${login.status}）`);
    continue;
  }

  if (account.role === "管理员") adminCookie = cookie;

  const me = await request("/api/auth/me", { headers: { cookie } });
  if (me.status !== 200) failures.push(`${account.role}登录后读取会话失败（${me.status}）`);

  for (const path of protectedHomes) {
    const response = await request(path, { headers: { cookie } });
    if (path === account.home && response.status !== 200) {
      failures.push(`${account.role}访问自身工作区 ${path} 失败（${response.status}）`);
    }
    if (path !== account.home && response.status !== 307) {
      failures.push(`${account.role}越权访问 ${path} 未被拦截（${response.status}）`);
    }
  }


  for (const path of rolePages[account.role]) {
    const response = await request(path, { headers: { cookie } });
    if (response.status !== 200) {
      failures.push(`${account.role}访问页面 ${path} 失败（${response.status}）`);
    }
  }
  if (account.role === "管理员") continue;

  const logout = await request("/api/auth/logout", { method: "POST", headers: { cookie } });
  const clearedCookie = logout.headers.get("set-cookie") || "";
  const cookieWasCleared = clearedCookie.startsWith("ecs_session=;")
    && (clearedCookie.includes("Max-Age=0") || clearedCookie.includes("Expires=Thu, 01 Jan 1970"));
  if (logout.status !== 303 || !cookieWasCleared) {
    failures.push(`${account.role}退出登录未正确清理会话（${logout.status}）`);
  }
}

if (adminCookie) {
  const smokeName = `发布测试模型-${Date.now()}`;
  const payload = new URLSearchParams({
    name: smokeName,
    provider: "custom",
    baseUrl: "https://example.invalid/v1",
    model: "smoke-model",
    apiKey: `smoke-secret-${Date.now()}`
  });
  const created = await request("/api/admin/ai-providers", {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/x-www-form-urlencoded" },
    body: payload.toString()
  });
  if (created.status !== 303 || !created.headers.get("location")?.includes("/admin/ai")) {
    failures.push(`管理员新增AI模型失败（${created.status}）`);
  }

  const provider = await prisma.aiProvider.findFirst({ where: { name: smokeName } });
  smokeProviderId = provider?.id || "";
  if (!smokeProviderId) failures.push("新增AI模型后数据库未找到记录");

  const meAfterCreate = await request("/api/auth/me", { headers: { cookie: adminCookie } });
  const listAfterCreate = await request("/admin/ai", { headers: { cookie: adminCookie } });
  const listBody = await listAfterCreate.text();
  if (meAfterCreate.status !== 200 || listAfterCreate.status !== 200 || !listBody.includes(smokeName)) {
    failures.push("新增AI模型后管理员会话失效或模型列表未更新");
  }

  if (smokeProviderId) {
    const deleted = await request("/api/admin/ai-providers", {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "delete", id: smokeProviderId }).toString()
    });
    if (deleted.status !== 303 || !deleted.headers.get("location")?.includes("/admin/ai")) {
      failures.push(`管理员删除AI模型失败（${deleted.status}）`);
    }
    const meAfterDelete = await request("/api/auth/me", { headers: { cookie: adminCookie } });
    if (meAfterDelete.status !== 200) failures.push("删除AI模型后管理员会话失效");
    smokeProviderId = "";
  }

  const logout = await request("/api/auth/logout", { method: "POST", headers: { cookie: adminCookie } });
  const clearedCookie = logout.headers.get("set-cookie") || "";
  if (logout.status !== 303 || !clearedCookie.startsWith("ecs_session=;")) {
    failures.push(`管理员退出登录未正确清理会话（${logout.status}）`);
  }
}

const publicPages = ["/", "/login", "/register", "/certificate/verify"];
for (const path of publicPages) {
  const response = await request(path);
  if (response.status !== 200) failures.push(`公共页面 ${path} 无法访问（${response.status}）`);
}

const health = await request("/api/health");
if (health.status !== 200) {
  failures.push(`健康检查接口异常（${health.status}）`);
} else {
  const payload = await health.json().catch(() => null);
  if (payload?.status !== "ok" || payload?.database !== "ready") {
    failures.push("健康检查未确认数据库可用");
  }
}

if (failures.length) {
  console.error("冒烟测试失败：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`冒烟测试通过：3 种角色、${Object.values(rolePages).flat().length} 个工作区页面、${protectedApiPaths.length} 个受保护API、AI模型增删会话、健康检查及 ${publicPages.length} 个公共页面均正常。`);
} finally {
  if (smokeProviderId) {
    await prisma.aiProvider.deleteMany({ where: { id: smokeProviderId } });
  }
  await prisma.aiProvider.deleteMany({ where: { name: { startsWith: "发布测试模型-" } } });
  await prisma.$disconnect();
}
