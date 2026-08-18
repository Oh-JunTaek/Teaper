import { describe, expect, it } from "vitest";
import { createMaterialStorageKey } from "./materialStorageKey";

describe("createMaterialStorageKey", () => {
  it("uses an ASCII-only opaque key while retaining a safe extension", () => {
    const key = createMaterialStorageKey(42, "화학Ⅰ 1학기 평가 계획 (최종).PDF", "fixed-id");
    expect(key).toBe("teacher-assessment/42/materials/fixed-id.pdf");
    expect(/^[\x00-\x7F]+$/.test(key)).toBe(true);
  });

  it("omits non-ASCII or unsafe extensions from the storage key", () => {
    expect(createMaterialStorageKey(7, "참고자료.최종", "fixed-id")).toBe("teacher-assessment/7/materials/fixed-id");
  });
});
