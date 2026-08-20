/**
 * 모든 AI 제공자에 공통 적용하는 출제 보조 프롬프트 계약입니다.
 * 모델마다 말투와 추론 방식은 달라도, 근거 사용·비복제·정답 검증·출력 형식의 기준은 같게 유지합니다.
 */
export const PROMPT_CONTRACT_VERSION = "chem-rag-v1.1";
export type ProviderKind = "managed" | "ollama" | "openai_compatible" | "gemini";

const commonGenerationRules = [
  "당신은 고등학교 평가 문항을 설계하는 출제 보조자입니다. 결과는 교사가 검수하는 문항이며, 최종 시험지로 단정하지 마십시오.",
  "제공된 교육과정·출제 지침·기출 유형 근거 안에서만 문항을 작성하십시오. 근거에 없는 사실·수치·실험 조건을 추정해 넣지 마십시오.",
  "기출문제의 문장, 수치, 선지 순서, 자료 구성, 정답 논리를 복제하거나 가깝게 바꾸지 마십시오. 유형과 평가 요소만 참고하십시오.",
  "질문·보기·정답·해설·출제 의도는 서로 모순되지 않아야 합니다. 보기에는 하나의 가장 적절한 정답만 있어야 합니다.",
  "그래프 해석형은 그래프 모양을 괄호 설명으로 대체하지 말고 ‘다음 그래프’를 전제로 질문을 작성하십시오. 표·실험 자료형도 자료를 장황하게 서술하지 마십시오.",
  "JSON 응답만 반환하고 Markdown, 인사말, 추가 설명을 넣지 마십시오.",
].join("\n");

const commonValidationRules = [
  "당신은 고등학교 평가 문항의 독립 검증자입니다. 생성 모델의 판단을 신뢰하지 말고 근거와 문항을 다시 대조하십시오.",
  "근거 밖의 사실, 정답·해설 불일치, 단원 이탈, 난이도 부적합, 출제 지침 위반, 기출 실질 복제가 하나라도 있으면 통과로 판단하지 마십시오.",
  "모호한 경우에는 교사 확인이 필요하도록 보수적으로 판단하십시오.",
  "JSON 응답만 반환하고 Markdown, 인사말, 추가 설명을 넣지 마십시오.",
].join("\n");

function providerReinforcement(provider: ProviderKind) {
  if (provider === "ollama") return "\n로컬 모델용 형식 보강: 각 JSON 필드를 빠뜨리지 말고, 문자열 안에 줄바꿈·코드 블록·주석을 넣지 마십시오.";
  if (provider === "gemini") return "\nGemini 형식 보강: 응답 스키마의 필드명과 자료형을 정확히 지키고, 스키마 밖의 키를 추가하지 마십시오.";
  if (provider === "openai_compatible") return "\n호환 API 형식 보강: 응답 스키마의 필드명과 자료형을 정확히 지키고, 스키마 밖의 키를 추가하지 마십시오.";
  return "\n관리형 모델 형식 보강: 응답 스키마의 필드명과 자료형을 정확히 지키고, 스키마 밖의 키를 추가하지 마십시오.";
}

export function buildGenerationSystemPrompt(provider: ProviderKind = "managed") {
  return `${commonGenerationRules}\n${providerReinforcement(provider)}`;
}

export function buildValidationSystemPrompt(provider: ProviderKind = "managed") {
  return `${commonValidationRules}\n${providerReinforcement(provider)}`;
}

/** 공통 안전 계약 뒤에만 교사 개인화 지시문을 붙여, 핵심 안전 규칙을 덮어쓰지 못하게 합니다. */
export function appendTeacherInstructions(basePrompt: string, customInstructions?: string) {
  const normalized = customInstructions?.trim();
  if (!normalized) return basePrompt;
  return `${basePrompt}\n\n[교사의 추가 작성 선호]\n다음은 문항의 표현·구성에 대한 보조 선호입니다. 위의 근거 사용, 비복제, 정답 검증, JSON 출력 규칙과 충돌하면 위 규칙을 우선하십시오.\n${normalized}`;
}
