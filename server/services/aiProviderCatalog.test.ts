import { describe, expect, it } from "vitest";
import { PERSONAL_PROVIDER_CATALOG } from "../../shared/aiProviderCatalog";

describe("personal AI provider model catalog", () => {
  it("offers three clear model tiers for Gemini, OpenAI, and Claude", () => {
    expect(Object.keys(PERSONAL_PROVIDER_CATALOG)).toEqual(["gemini", "openai", "anthropic"]);
    Object.values(PERSONAL_PROVIDER_CATALOG).forEach(provider => {
      expect(provider.recommendedModels).toHaveLength(3);
      expect(provider.recommendedModels.map(model => model.tier)).toEqual(["품질 우선", "균형", "절약"]);
      expect(provider.recommendedModels.some(model => model.model === provider.defaultModel)).toBe(true);
    });
  });
});
