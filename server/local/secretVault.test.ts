import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getLocalProviderSecret, isLocalVaultMode, setLocalProviderSecret } from "./secretVault";

const original = { mode: process.env.LOCAL_APP_MODE, key: process.env.LOCAL_VAULT_MASTER_KEY, path: process.env.LOCAL_SECRET_VAULT_PATH };
const tempPaths: string[] = [];

afterEach(async () => {
  process.env.LOCAL_APP_MODE = original.mode;
  process.env.LOCAL_VAULT_MASTER_KEY = original.key;
  process.env.LOCAL_SECRET_VAULT_PATH = original.path;
  await Promise.all(tempPaths.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe("local secret vault", () => {
  it("stores a secret only in encrypted local vault mode", async () => {
    const folder = await mkdtemp(join(tmpdir(), "teacher-vault-"));
    tempPaths.push(folder);
    process.env.LOCAL_APP_MODE = "true";
    process.env.LOCAL_VAULT_MASTER_KEY = "12345678910111213141516171819202122";
    process.env.LOCAL_SECRET_VAULT_PATH = join(folder, "secrets.vault");

    await setLocalProviderSecret("gemini-teacher-1", "personal-api-key");
    expect(isLocalVaultMode()).toBe(true);
    await expect(getLocalProviderSecret("gemini-teacher-1")).resolves.toBe("personal-api-key");
  });

  it("refuses local vault access in web runtime", async () => {
    process.env.LOCAL_APP_MODE = "false";
    await expect(setLocalProviderSecret("any", "key")).rejects.toThrow("로컬 앱 모드");
  });
});
