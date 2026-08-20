import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedRecommendedModel, ollamaInstallPlan, recommendLocalModels } from "../src/setupPlan.mjs";

describe("로컬 AI 설치 계획", () => {
  it("Windows에서는 설치 파일 중심 경로를 제공한다", () => {
    const plan = ollamaInstallPlan("win32");
    assert.equal(plan.supported, true);
    assert.match(plan.downloadUrl, /ollama\.com/);
  });

  it("사양에 따라 권장 모델을 단계적으로 고른다", () => {
    assert.equal(recommendLocalModels({ memoryGb: 8, vramGb: 0 }).model, "gemma3n:e2b");
    assert.equal(recommendLocalModels({ memoryGb: 12, vramGb: 0 }).model, "gemma3n:e4b");
    assert.equal(recommendLocalModels({ memoryGb: 16, vramGb: 0 }).model, "qwen3:8b");
    assert.equal(recommendLocalModels({ memoryGb: 32, vramGb: 10 }).model, "qwen3:14b");
    assert.equal(isAllowedRecommendedModel("qwen3:8b"), true);
    assert.equal(isAllowedRecommendedModel("gemma3n:e2b"), true);
    assert.equal(isAllowedRecommendedModel("arbitrary-model"), false);
  });
});
