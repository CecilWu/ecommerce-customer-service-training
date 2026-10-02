import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  throw new Error("未找到 .env，无法安全轮换密钥");
}

const envText = readFileSync(envPath, "utf8");
const envMode = statSync(envPath).mode;

function parseEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    result[key] = value;
  }
  return result;
}

function upsertEnv(text, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\s*$/, "")}\n${line}\n`;
}

function deriveKey(value) {
  return createHash("sha256").update(value).digest();
}

function decryptValue(value, legacyKey, currentKey) {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (!ivText || !tagText || !encryptedText || !["v1", "v2"].includes(version)) {
    throw new Error("发现无法识别的 AI Key 密文格式");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    version === "v1" ? legacyKey : currentKey,
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function encryptValue(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

const fileEnv = parseEnv(envText);
const oldSessionSecret = fileEnv.SESSION_SECRET;
if (!oldSessionSecret) throw new Error(".env 缺少 SESSION_SECRET");

const oldAiSecret = fileEnv.AI_CONFIG_ENCRYPTION_KEY || oldSessionSecret;
const newSessionSecret = randomBytes(48).toString("base64url");
const newAiSecret = randomBytes(48).toString("base64url");
const newAiKey = deriveKey(newAiSecret);

let nextEnvText = upsertEnv(envText, "SESSION_SECRET", newSessionSecret);
nextEnvText = upsertEnv(nextEnvText, "AI_CONFIG_ENCRYPTION_KEY", newAiSecret);
const pendingEnvPath = `${envPath}.next`;
writeFileSync(pendingEnvPath, nextEnvText, { mode: envMode });

const databaseUrl = fileEnv.DATABASE_URL || "file:./dev.db";
if (!databaseUrl.startsWith("file:")) {
  rmSync(pendingEnvPath, { force: true });
  throw new Error("当前轮换脚本仅支持 SQLite file: 数据库");
}

const databasePath = resolve(root, "prisma", databaseUrl.slice("file:".length));
if (!existsSync(databasePath)) {
  rmSync(pendingEnvPath, { force: true });
  throw new Error(`未找到数据库：${databasePath}`);
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
const backupDir = process.env.BACKUP_DIR
  ? resolve(process.env.BACKUP_DIR)
  : resolve(root, "..", "ecommerce-training-backups");
mkdirSync(backupDir, { recursive: true });
const backupPath = resolve(backupDir, `dev.db.before-secret-rotation-${stamp}`);
copyFileSync(databasePath, backupPath);

process.env.DATABASE_URL = databaseUrl;
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const providers = await prisma.aiProvider.findMany({
    where: { apiKeyEncrypted: { not: null } },
    select: { id: true, apiKeyEncrypted: true }
  });

  const migrated = providers.map((provider) => {
    const plaintext = decryptValue(
      provider.apiKeyEncrypted,
      deriveKey(oldSessionSecret),
      deriveKey(oldAiSecret)
    );
    if (!plaintext) throw new Error(`模型 ${provider.id} 的 API Key 解密结果为空`);
    return { id: provider.id, apiKeyEncrypted: encryptValue(plaintext, newAiKey) };
  });

  await prisma.$transaction(
    migrated.map((provider) =>
      prisma.aiProvider.update({
        where: { id: provider.id },
        data: { apiKeyEncrypted: provider.apiKeyEncrypted }
      })
    )
  );

  renameSync(pendingEnvPath, envPath);
  console.log(`密钥轮换完成：已迁移 ${migrated.length} 个模型配置。`);
  console.log(`数据库备份：${backupPath}`);
  console.log("现有登录会话将失效，请重新登录。密钥内容未输出。" );
} catch (error) {
  rmSync(pendingEnvPath, { force: true });
  copyFileSync(backupPath, databasePath);
  throw error;
} finally {
  await prisma.$disconnect();
}
