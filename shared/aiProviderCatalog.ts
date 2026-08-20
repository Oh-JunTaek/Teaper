export type PersonalProviderType = "gemini" | "openai_compatible" | "anthropic";

export type RecommendedModel = {
  model: string;
  tier: "품질 우선" | "균형" | "절약";
  description: string;
};

export type PersonalProviderCatalogEntry = {
  providerType: PersonalProviderType;
  label: string;
  apiLabel: string;
  documentationUrl: string;
  defaultModel: string;
  recommendedModels: readonly RecommendedModel[];
};

// 공식 API 문서를 기준으로 고른 초기값입니다. 실제 사용 가능 여부는 각 교사의 API 키 연결 확인에서 다시 검사합니다.
export const PERSONAL_PROVIDER_CATALOG = {
  gemini: {
    providerType: "gemini",
    label: "Google Gemini API",
    apiLabel: "Google AI Studio에서 발급한 Gemini 키",
    documentationUrl: "https://ai.google.dev/gemini-api/docs/models",
    defaultModel: "gemini-3.6-flash",
    recommendedModels: [
      { model: "gemini-3.7-flash", tier: "품질 우선", description: "복잡한 근거·해설을 더 꼼꼼히 다룰 때" },
      { model: "gemini-3.6-flash", tier: "균형", description: "일반적인 문항 생성과 검수에 권장" },
      { model: "gemini-3.5-flash-lite", tier: "절약", description: "빠른 시안 비교와 반복 생성에 적합" },
    ],
  },
  openai: {
    providerType: "openai_compatible",
    label: "OpenAI API",
    apiLabel: "OpenAI 플랫폼에서 발급한 API 키",
    documentationUrl: "https://developers.openai.com/api/docs/models",
    defaultModel: "gpt-5.6-terra",
    recommendedModels: [
      { model: "gpt-5.6-sol", tier: "품질 우선", description: "복잡한 개념 연결과 정답·해설 검수에 적합" },
      { model: "gpt-5.6-terra", tier: "균형", description: "품질과 호출 비용의 균형을 고려한 기본값" },
      { model: "gpt-5.6-luna", tier: "절약", description: "고빈도 초안 생성과 짧은 반복에 적합" },
    ],
  },
  anthropic: {
    providerType: "anthropic",
    label: "Anthropic Claude API",
    apiLabel: "Anthropic Console에서 발급한 Claude API 키",
    documentationUrl: "https://platform.claude.com/docs/en/about-claude/models/overview",
    defaultModel: "claude-sonnet-5",
    recommendedModels: [
      { model: "claude-opus-5", tier: "품질 우선", description: "복잡한 근거 해석과 출제 의도 검수에 적합" },
      { model: "claude-sonnet-5", tier: "균형", description: "문항 생성·해설·검수의 균형형 기본값" },
      { model: "claude-haiku-4-5", tier: "절약", description: "빠른 시안 생성과 간단한 검수에 적합" },
    ],
  },
} as const satisfies Record<string, PersonalProviderCatalogEntry>;

export const PERSONAL_PROVIDER_LIST = Object.values(PERSONAL_PROVIDER_CATALOG);
