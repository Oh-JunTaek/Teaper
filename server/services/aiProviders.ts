import { decryptPersonalApiKey } from "./personalApiCrypto";

export type ProviderKind = "managed" | "ollama" | "openai_compatible" | "gemini";

export type ResolvedProvider = {
  kind: ProviderKind;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  providerSettingId?: number;
  externalTransfer: boolean;
};

type StoredProvider = {
  id: number;
  providerType: ProviderKind;
  baseUrl: string | null;
  model: string;
  encryptedApiKey: string | null;
  allowExternalTransfer: number;
  externalTransferConsentAt: Date | null;
};

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export function validateProviderUrl(kind: Exclude<ProviderKind, "managed" | "gemini">, rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("AI 제공자 주소가 올바른 URL이 아닙니다.");
  }
  if (kind === "ollama") {
    if (!loopbackHosts.has(url.hostname)) throw new Error("로컬 Ollama 주소는 localhost 또는 127.0.0.1만 사용할 수 있습니다.");
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("로컬 Ollama 주소는 HTTP(S) 주소여야 합니다.");
  } else if (url.protocol !== "https:") {
    throw new Error("개인 외부 API 주소는 HTTPS를 사용해야 합니다.");
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveProvider(stored?: StoredProvider, hasRequestConsent = false): ResolvedProvider {
  if (!stored) return { kind: "managed", model: "managed-default", externalTransfer: true };
  if (stored.providerType === "managed") return { kind: "managed", model: "managed-default", providerSettingId: stored.id, externalTransfer: true };
  if (stored.providerType === "ollama") {
    return { kind: "ollama", model: stored.model, baseUrl: validateProviderUrl("ollama", stored.baseUrl || "http://127.0.0.1:11434"), providerSettingId: stored.id, externalTransfer: false };
  }
  if (!stored.allowExternalTransfer || !stored.externalTransferConsentAt || !hasRequestConsent) {
    throw new Error("개인 외부 AI를 사용하려면 전송 범위를 확인하고 이번 요청에 동의해야 합니다.");
  }
  if (!stored.encryptedApiKey) throw new Error("개인 API 키가 등록되지 않았습니다.");
  if (stored.providerType === "gemini") {
    return { kind: "gemini", model: stored.model, apiKey: decryptPersonalApiKey(stored.encryptedApiKey), providerSettingId: stored.id, externalTransfer: true };
  }
  return { kind: "openai_compatible", model: stored.model, baseUrl: validateProviderUrl("openai_compatible", stored.baseUrl || ""), apiKey: decryptPersonalApiKey(stored.encryptedApiKey), providerSettingId: stored.id, externalTransfer: true };
}

export async function checkProviderConnection(provider: ResolvedProvider) {
  if (provider.kind === "managed") return { status: "ready", models: ["관리형 AI"], message: "관리형 AI 제공자를 사용할 수 있습니다." };
  if (provider.kind === "ollama") {
    const response = await fetch(`${provider.baseUrl}/api/tags`, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) throw new Error(`Ollama 연결 실패 (${response.status})`);
    const data = await response.json() as { models?: Array<{ name?: string }> };
    return { status: "ready", models: (data.models || []).map(model => model.name || "").filter(Boolean), message: "로컬 Ollama 연결을 확인했습니다." };
  }
  if (provider.kind === "gemini") {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": provider.apiKey || "" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Gemini API 연결 실패 (${response.status})`);
    return { status: "ready", models: [provider.model], message: "개인 Gemini API 키를 확인했습니다." };
  }
  const response = await fetch(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`개인 OpenAI 호환 API 연결 실패 (${response.status})`);
  return { status: "ready", models: [provider.model], message: "개인 OpenAI 호환 API 키를 확인했습니다." };
}
