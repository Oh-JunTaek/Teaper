import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

type Vault = Record<string, string>;

function localMode() {
  return process.env.LOCAL_APP_MODE === "true";
}

function vaultPath() {
  return process.env.LOCAL_SECRET_VAULT_PATH || join(homedir(), ".teacher-assessment-assistant", "secrets.vault");
}

function vaultKey() {
  const masterKey = process.env.LOCAL_VAULT_MASTER_KEY;
  if (!masterKey || masterKey.length < 32) throw new Error("로컬 암호화 vault의 마스터 키가 설정되지 않았습니다.");
  return crypto.scryptSync(masterKey, "teacher-assessment-local-vault-v1", 32);
}

function encrypt(value: Vault) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64url");
}

function decrypt(payload: string): Vault {
  const data = Buffer.from(payload, "base64url");
  if (data.length < 29) throw new Error("로컬 vault 형식이 올바르지 않습니다.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")) as Vault;
}

async function loadVault(): Promise<Vault> {
  try { return decrypt(await readFile(vaultPath(), "utf8")); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveVault(vault: Vault) {
  const path = vaultPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, encrypt(vault), { encoding: "utf8", mode: 0o600 });
  await rename(tempPath, path);
}

export async function setLocalProviderSecret(reference: string, apiKey: string) {
  if (!localMode()) throw new Error("로컬 암호화 vault는 로컬 앱 모드에서만 사용할 수 있습니다.");
  const vault = await loadVault();
  vault[reference] = apiKey;
  await saveVault(vault);
}

export async function getLocalProviderSecret(reference: string) {
  if (!localMode()) throw new Error("로컬 암호화 vault는 로컬 앱 모드에서만 사용할 수 있습니다.");
  return (await loadVault())[reference];
}

export function isLocalVaultMode() {
  return localMode();
}
