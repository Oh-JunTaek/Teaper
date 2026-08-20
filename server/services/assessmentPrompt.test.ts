import { describe, expect, it } from "vitest";
import { appendTeacherInstructions, buildGenerationSystemPrompt, buildValidationSystemPrompt, PROMPT_CONTRACT_VERSION } from "./assessmentPrompt";

describe("assessment prompt contract", () => {
  it("모든 제공자에 같은 핵심 출제 규칙을 적용한다", () => {
    for (const provider of ["managed", "ollama", "openai_compatible", "gemini"] as const) {
      const prompt = buildGenerationSystemPrompt(provider);
      expect(prompt).toContain("근거에 없는 사실");
      expect(prompt).toContain("기출문제의 문장");
      expect(prompt).toContain("JSON 응답만");
    }
  });

  it("검증 계약은 보수적 판정과 버전 기록 원칙을 포함한다", () => {
    expect(buildValidationSystemPrompt("managed")).toContain("보수적으로 판단");
    expect(PROMPT_CONTRACT_VERSION).toBe("chem-rag-v1.1");
  });

  it("교사 추가 지시문은 공통 계약 뒤에만 붙이고 공통 규칙을 유지한다", () => {
    const prompt = appendTeacherInstructions(buildGenerationSystemPrompt("ollama"), "계산 과정의 단위를 확인");
    expect(prompt).toContain("근거에 없는 사실");
    expect(prompt).toContain("계산 과정의 단위를 확인");
    expect(prompt).toContain("위 규칙을 우선");
  });
});
