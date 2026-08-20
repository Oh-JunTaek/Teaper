import { describe, expect, it } from "vitest";
import { createManagedAiUsageEntry, managedAiDurationBucket, managedAiOutcomeFromError, managedAiUsageDate } from "./managedAiUsage";

describe("managed AI privacy-minimized usage entries", () => {
  it("records only aggregate dimensions without a user, prompt, document, or API key field", () => {
    const entry = createManagedAiUsageEntry({ operation: "generation", outcome: "success", model: "gpt-5-mini", durationMs: 6_000, at: new Date("2026-08-20T00:00:00Z") });
    expect(entry).toEqual({ usageDate: "2026-08-20", operation: "generation", outcome: "success", model: "gpt-5-mini", durationBucket: "5_to_15s", knownInputTokens: 0, knownOutputTokens: 0 });
    expect(Object.keys(entry)).not.toContain("userId");
    expect(Object.keys(entry)).not.toContain("prompt");
    expect(Object.keys(entry)).not.toContain("fileName");
  });

  it("classifies duration and upstream limit failures into compact aggregate values", () => {
    expect(managedAiDurationBucket(4_999)).toBe("under_5s");
    expect(managedAiDurationBucket(15_000)).toBe("15_to_45s");
    expect(managedAiOutcomeFromError(new Error("LLM invoke failed: 429 Too Many Requests"))).toBe("limited");
    expect(managedAiOutcomeFromError(new Error("network unavailable"))).toBe("failure");
    expect(managedAiUsageDate(new Date("2026-08-19T15:01:00Z"))).toBe("2026-08-20");
  });
});
