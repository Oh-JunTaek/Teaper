import { describe, expect, it } from "vitest";
import { canAccessProtectedStorageKey } from "./storageProxy";

describe("canAccessProtectedStorageKey", () => {
  it("현재 교사의 자료·기출 원본 키만 허용한다", () => {
    expect(canAccessProtectedStorageKey("teacher-assessment/12/materials/opaque-file.pdf", 12)).toBe(true);
    expect(canAccessProtectedStorageKey("reference-pdfs/12/opaque-file.pdf", 12)).toBe(true);
  });

  it("다른 교사·알 수 없는 키·잘못된 사용자 식별자는 거절한다", () => {
    expect(canAccessProtectedStorageKey("teacher-assessment/13/materials/opaque-file.pdf", 12)).toBe(false);
    expect(canAccessProtectedStorageKey("teacher-assessment/12/other/opaque-file.pdf", 12)).toBe(false);
    expect(canAccessProtectedStorageKey("reference-pdfs/12/opaque-file.pdf", 0)).toBe(false);
  });
});
