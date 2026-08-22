import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCAL_MODEL_SETTINGS, generationOptions, normalizeLocalModelSettings, supportsThinking } from "../src/localModelSettings.mjs";

test("로컬 모델 고급 설정은 안전한 선택값과 범위만 저장한다", () => {
  const safe = normalizeLocalModelSettings({ contextTokens: 32000, maxOutputTokens: 9999, temperature: 4, topK: 0, topP: 2, thinkingEnabled: true, speculativeDecodingEnabled: true });
  assert.equal(safe.contextTokens, DEFAULT_LOCAL_MODEL_SETTINGS.contextTokens);
  assert.equal(safe.maxOutputTokens, DEFAULT_LOCAL_MODEL_SETTINGS.maxOutputTokens);
  assert.equal(safe.temperature, 1.2);
  assert.equal(safe.topK, 1);
  assert.equal(safe.topP, 1);
  assert.equal(safe.thinkingEnabled, true);
  assert.equal(safe.speculativeDecodingEnabled, true);
});

test("Ollama·llama.cpp 요청 옵션은 저장된 토큰과 샘플링 값을 반영한다", () => {
  assert.deepEqual(generationOptions({ contextTokens: 8192, maxOutputTokens: 1536, temperature: 0.4, topK: 24, topP: 0.85 }), { temperature: 0.4, top_k: 24, top_p: 0.85, num_predict: 1536, num_ctx: 8192 });
  assert.equal(supportsThinking("qwen3:4b"), true);
  assert.equal(supportsThinking("gemma3n:e2b"), false);
});
