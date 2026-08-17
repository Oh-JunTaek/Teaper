import crypto from "node:crypto";
import { ENV } from "../_core/env";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  if (ENV.personalApiEncryptionKey.trim().length < 32) {
    throw new Error("개인 API 암호화 키가 설정되지 않았거나 너무 짧습니다.");
  }
  return crypto.createHash("sha256").update(ENV.personalApiEncryptionKey, "utf8").digest();
}

export function encryptPersonalApiKey(plainText: string) {
  if (!plainText.trim()) throw new Error("개인 API 키가 비어 있습니다.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptPersonalApiKey(cipherText: string) {
  const payload = Buffer.from(cipherText, "base64url");
  if (payload.length < 29) throw new Error("암호화된 개인 API 키 형식이 올바르지 않습니다.");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function apiKeyHint(apiKey: string) {
  const value = apiKey.trim();
  return value.length <= 8 ? "••••" : `••••${value.slice(-4)}`;
}
