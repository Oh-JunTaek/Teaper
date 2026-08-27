import { describe, expect, it } from "vitest";
import { normalizedQuickQuizReviewStates, quickQuizPendingOverview } from "./quickQuizReview";

describe("quickQuizPendingOverview", () => {
  it("counts all missing legacy states as pending and identifies the newest pending set by creation time", () => {
    const records = [
      { id: 1, questionCount: 2, questionReviewStates: ["approved", "rejected"] as const, createdAt: "2026-08-27T01:00:00.000Z" },
      { id: 2, questionCount: 3, questionReviewStates: ["approved", "pending_review", "revised"] as const, createdAt: "2026-08-27T02:00:00.000Z" },
      { id: 3, questionCount: 2, createdAt: "2026-08-27T03:00:00.000Z" },
    ];

    expect(normalizedQuickQuizReviewStates(records[2])).toEqual(["pending_review", "pending_review"]);
    expect(quickQuizPendingOverview(records)).toMatchObject({ pendingSetCount: 2, pendingQuestionCount: 3, latestPending: { id: 3 } });
  });
});
