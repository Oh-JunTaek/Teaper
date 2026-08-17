import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

function pathForVault() {
  return process.env.LOCAL_SECRET_VAULT_PATH || join(process.env.LOCAL_APP_DATA_DIR || join(homedir(), ".teacher-assessment-assistant"), "secrets.vault");
}
function vaultKey() {
  const value = process.env.LOCAL_VAULT_MASTER_KEY;
  if (!value || value.length < 32) throw new Error("LOCAL_VAULT_MASTER_KEY는 32자 이상이어야 합니다.");
  return crypto.scryptSync(value, "teacher-assessment-desktop-v1", 32);
}
function seal(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}
function open(payload) {
  const data = Buffer.from(payload, "base64url");
  if (data.length < 29) throw new Error("로컬 vault 형식이 올바르지 않습니다.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}
async function load() {
  try { return open(await readFile(pathForVault(), "utf8")); } catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}
async function save(value) {
  const target = pathForVault();
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const temp = `${target}.tmp`;
  await writeFile(temp, seal(value), { encoding: "utf8", mode: 0o600 });
  await rename(temp, target);
}
export async function setSecret(reference, secret) { const values = await load(); values[reference] = secret; await save(values); }
export async function getSecret(reference) { return (await load())[reference]; }
export async function deleteSecret(reference) { const values = await load(); delete values[reference]; await save(values); }
