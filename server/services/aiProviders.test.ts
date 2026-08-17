import { describe, expect, it } from "vitest";
import { resolveProvider, validateProviderUrl } from "./aiProviders";

describe("AI provider safety rules", () => {
  it("allows Ollama only on a loopback address", () => {
    expect(validateProviderUrl("ollama", "http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
    expect(() => validateProviderUrl("ollama", "https://remote.example.com")).toThrow("localhost 또는 127.0.0.1");
  });

  it("requires per-request consent before resolving an external personal provider", () => {
    const stored = {
      id: 1,
      providerType: "gemini" as const,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: "gemini-2.5-flash",
      encryptedApiKey: "invalid-will-not-be-read-without-consent",
      allowExternalTransfer: 1,
      externalTransferConsentAt: new Date(),
    };
    expect(() => resolveProvider(stored, false)).toThrow("이번 요청에 동의");
  });

  it("resolves a local provider without external transfer consent", () => {
    const provider = resolveProvider({ id: 2, providerType: "ollama", baseUrl: "http://localhost:11434", model: "qwen3:8b", encryptedApiKey: null, allowExternalTransfer: 0, externalTransferConsentAt: null }, false);
    expect(provider).toMatchObject({ kind: "ollama", externalTransfer: false, model: "qwen3:8b" });
  });
});
