/** Windows 로컬 실행기에서 공통으로 받을 수 있는 값만 허용한다. 실행기 시작 옵션은 앱이 강제로 바꾸지 않는다. */
export const LOCAL_MODEL_SETTINGS_VERSION = "local-model-settings-v1";
export const DEFAULT_LOCAL_MODEL_SETTINGS = Object.freeze({
  contextTokens: 4096,
  maxOutputTokens: 1024,
  temperature: 0.35,
  topK: 20,
  topP: 0.9,
  accelerationPreference: "runtime",
  thinkingEnabled: false,
  speculativeDecodingEnabled: false,
});

const contexts = new Set([2048, 4096, 8192]);
const outputs = new Set([512, 768, 1024, 1536]);
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeLocalModelSettings(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const contextTokens = number(input.contextTokens, DEFAULT_LOCAL_MODEL_SETTINGS.contextTokens);
  const maxOutputTokens = number(input.maxOutputTokens, DEFAULT_LOCAL_MODEL_SETTINGS.maxOutputTokens);
  return {
    contextTokens: contexts.has(contextTokens) ? contextTokens : DEFAULT_LOCAL_MODEL_SETTINGS.contextTokens,
    maxOutputTokens: outputs.has(maxOutputTokens) ? maxOutputTokens : DEFAULT_LOCAL_MODEL_SETTINGS.maxOutputTokens,
    temperature: Math.min(1.2, Math.max(0, number(input.temperature, DEFAULT_LOCAL_MODEL_SETTINGS.temperature))),
    topK: Math.min(100, Math.max(1, Math.round(number(input.topK, DEFAULT_LOCAL_MODEL_SETTINGS.topK)))),
    topP: Math.min(1, Math.max(0.1, number(input.topP, DEFAULT_LOCAL_MODEL_SETTINGS.topP))),
    accelerationPreference: ["runtime", "cpu", "gpu"].includes(input.accelerationPreference) ? input.accelerationPreference : "runtime",
    thinkingEnabled: input.thinkingEnabled === true,
    speculativeDecodingEnabled: input.speculativeDecodingEnabled === true,
  };
}

/** Ollama와 llama.cpp 완료 요청에서 공통으로 쓸 수 있는 보수적 생성 옵션이다. */
export function generationOptions(settings) {
  const safe = normalizeLocalModelSettings(settings);
  return { temperature: safe.temperature, top_k: safe.topK, top_p: safe.topP, num_predict: safe.maxOutputTokens, num_ctx: safe.contextTokens };
}

/** 생각 과정이 아니라 최종 답을 받는 방식으로만 활용한다. 지원하지 않는 모델은 API에 전달하지 않는다. */
export function supportsThinking(model) {
  return /(?:qwen3|gemma[\s_-]*4|deepseek-r1|reasoner)/i.test(String(model || ""));
}
