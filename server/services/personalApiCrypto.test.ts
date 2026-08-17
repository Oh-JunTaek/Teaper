import { describe, expect, it } from "vitest";
import { decryptPersonalApiKey, encryptPersonalApiKey } from "./personalApiCrypto";

describe("personal API encryption key configuration", () => {
  it("provides a non-empty server-only encryption key of adequate length", () => {
    const key = process.env.PERSONAL_API_ENCRYPTION_KEY;

    expect(key).toBeTypeOf("string");
    expect(key?.trim().length).toBeGreaterThanOrEqual(32);
  });

  it("round-trips a personal API key without retaining plaintext in ciphertext", () => {
    const apiKey = "personal-api-key-for-test";
    const encrypted = encryptPersonalApiKey(apiKey);

    expect(encrypted).not.toContain(apiKey);
    expect(decryptPersonalApiKey(encrypted)).toBe(apiKey);
  });
});
