import { describe, expect, it } from "vitest";

describe("application title configuration", () => {
  it("uses the configured problem-authoring workspace title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("교사도우미 | 문제 출제 워크스페이스");
  });
});
