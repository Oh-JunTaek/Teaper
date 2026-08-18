import { describe, expect, it } from "vitest";
import { createReferenceStorageKey } from "./referenceStorageKey";

describe("createReferenceStorageKey", () => {
  it("한글 PDF 파일명을 표시용과 분리해 ASCII 저장 키로 변환한다", () => {
    const key = createReferenceStorageKey(42, "2025학년도 화학Ⅰ 기출문제.pdf");
    expect(key).toMatch(/^reference-pdfs\/42\/[\x00-\x7F]+\.pdf$/);
    expect(key).not.toContain("화학");
  });
});
