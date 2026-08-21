import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const BACKUP_FORMAT = "eunma-local-backup-v1";

function deriveKey(password, salt) {
  if (typeof password !== "string" || password.length < 12) throw new Error("백업 암호는 12자 이상으로 설정하세요.");
  return scryptSync(password, salt, 32);
}

export function sealBackup(snapshot, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify({ format: BACKUP_FORMAT, createdAt: new Date().toISOString(), snapshot }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return JSON.stringify({ format: BACKUP_FORMAT, kdf: "scrypt", salt: salt.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") });
}

export function openBackup(serialized, password) {
  const envelope = JSON.parse(serialized);
  if (envelope?.format !== BACKUP_FORMAT || envelope?.kdf !== "scrypt") throw new Error("문제 출제 워크스페이스 로컬 백업 파일이 아닙니다.");
  const key = deriveKey(password, Buffer.from(envelope.salt, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]).toString("utf8"));
  if (payload?.format !== BACKUP_FORMAT || !payload?.snapshot) throw new Error("백업 내용이 올바르지 않습니다.");
  return payload.snapshot;
}
