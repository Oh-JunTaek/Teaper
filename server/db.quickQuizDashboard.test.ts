import { describe, expect, it } from "vitest";
import { quickQuizDashboardQuestionCounts } from "./db";

describe("quickQuizDashboardQuestionCounts", () => {
  it("counts only approved and pending quick-quiz questions, treating legacy null states as pending", () => {
    expect(quickQuizDashboardQuestionCounts([
      { questions: [{}, {}, {}], questionReviewStates: ["approved", "rejected", "pending_review"] },
      { questions: [{}, {}], questionReviewStates: null },
    ])).toEqual({ pendingReview: 3, approved: 1, reviewed: 2 });
  });
});
