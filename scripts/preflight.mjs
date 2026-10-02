import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
  );
}

const fileEnv = parseEnvFile(resolve(process.cwd(), ".env"));
const env = { ...fileEnv, ...process.env };
const errors = [];
const warnings = [];
const forbiddenSecrets = new Set([
  "change-this-to-a-long-random-string",
  "local-development-session-secret-change-on-vps",
  "change-this-to-another-long-random-string"
]);

if (!env.DATABASE_URL) errors.push("缺少 DATABASE_URL");
if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || forbiddenSecrets.has(env.SESSION_SECRET)) {
  errors.push("SESSION_SECRET 必须为至少 32 个字符的随机字符串，且不能使用示例值");
}
if (!env.AI_CONFIG_ENCRYPTION_KEY || env.AI_CONFIG_ENCRYPTION_KEY.length < 32 || forbiddenSecrets.has(env.AI_CONFIG_ENCRYPTION_KEY)) {
  errors.push("AI_CONFIG_ENCRYPTION_KEY 必须为至少 32 个字符的独立随机字符串，且不能使用示例值");
}
const cookieSecure = String(env.SESSION_COOKIE_SECURE || "").trim().toLowerCase();
if (cookieSecure && !["true", "false", "1", "0", "yes", "no"].includes(cookieSecure)) {
  errors.push("SESSION_COOKIE_SECURE 只能填写 true 或 false");
}
const appUrl = String(env.APP_URL || env.NEXT_PUBLIC_APP_URL || "").trim();
let parsedAppUrl;
if (!env.APP_URL) {
  warnings.push("建议配置运行时 APP_URL，确保反向代理后的跳转地址正确");
}
if (env.APP_URL && env.NEXT_PUBLIC_APP_URL && env.APP_URL !== env.NEXT_PUBLIC_APP_URL) {
  errors.push("APP_URL 与 NEXT_PUBLIC_APP_URL 必须完全一致");
}
if (!appUrl) {
  warnings.push("建议配置 APP_URL 和 NEXT_PUBLIC_APP_URL");
} else {
  try {
    parsedAppUrl = new URL(appUrl);
    if (!["http:", "https:"].includes(parsedAppUrl.protocol)) {
      errors.push("APP_URL 只能使用 http:// 或 https://");
    }
    if (parsedAppUrl.username || parsedAppUrl.password || parsedAppUrl.pathname !== "/" || parsedAppUrl.search || parsedAppUrl.hash) {
      errors.push("APP_URL 只能填写站点根地址，不能包含账号、路径、参数或锚点");
    }
  } catch {
    errors.push("APP_URL 不是有效的网址");
  }
}
if (parsedAppUrl?.protocol === "http:") {
  if (!["false", "0", "no"].includes(cookieSecure)) {
    errors.push("使用 HTTP 地址时必须显式设置 SESSION_COOKIE_SECURE=false，否则登录 Cookie 无法使用");
  }
  warnings.push("当前使用明文 HTTP，账号密码和登录会话可能被窃听，仅建议临时测试使用");
} else if (parsedAppUrl?.protocol === "https:" && !["true", "1", "yes"].includes(cookieSecure)) {
  errors.push("使用 HTTPS 地址时必须显式设置 SESSION_COOKIE_SECURE=true");
}
if (!env.NODE_ENV || env.NODE_ENV !== "production") warnings.push("正式启动时请确保 NODE_ENV=production");

if (errors.length) {
  console.error("上线预检失败：");
  for (const item of errors) console.error(`- ${item}`);
  process.exit(1);
}

console.log("上线必要配置检查通过。");
for (const item of warnings) console.warn(`提示：${item}`);
