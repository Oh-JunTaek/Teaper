import { describe, expect, it } from "vitest";
import { runMiddleMathVerificationPack } from "./middleMathVerificationPack";

describe("middle school math verification pack", () => {
  it("keeps representative arithmetic, linear, proportion, and statistics checks passing", () => {
    const results = runMiddleMathVerificationPack();
    expect(results).toHaveLength(4);
    expect(results.map(item => item.result.status)).toEqual(["checked_match", "checked_match", "checked_match", "checked_match"]);
  });
});
