import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export type RuntimeAIConfig = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  source: "database" | "environment";
};

const DEVELOPMENT_SECRET = "local-development-session-secret-change-on-vps";

function deriveKey(value: string) {
  return createHash("sha256").update(value).digest();
}

function currentKeyMaterial() {
  return deriveKey(process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.SESSION_SECRET || DEVELOPMENT_SECRET);
}

function legacyKeyMaterial() {
  return deriveKey(process.env.SESSION_SECRET || DEVELOPMENT_SECRET);
}

function decryptWithKey(ivText: string, tagText: string, encryptedText: string, key: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", currentKeyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptApiKey(value: string | null | undefined) {
  if (!value) return "";
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (!ivText || !tagText || !encryptedText || !["v1", "v2"].includes(version)) return "";
  try {
    return decryptWithKey(
      ivText,
      tagText,
      encryptedText,
      version === "v1" ? legacyKeyMaterial() : currentKeyMaterial()
    );
  } catch {
    return "";
  }
}

export async function getRuntimeAIConfig(): Promise<RuntimeAIConfig | null> {
  const activeProviders = await prisma.aiProvider.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" }
  });

  for (const active of activeProviders) {
    const apiKey = decryptApiKey(active.apiKeyEncrypted);
    if (apiKey) {
      return {
        provider: active.provider,
        baseUrl: active.baseUrl,
        model: active.model,
        apiKey,
        source: "database"
      };
    }
  }

  if (["openai", "deepseek"].includes(process.env.AI_MODE ?? "") && process.env.OPENAI_API_KEY) {
    return {
      provider: process.env.AI_MODE ?? "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
      model: process.env.OPENAI_MODEL || "deepseek-chat",
      apiKey: process.env.OPENAI_API_KEY,
      source: "environment"
    };
  }

  return null;
}
