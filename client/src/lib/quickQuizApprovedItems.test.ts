import { describe, expect, it } from "vitest";
import { approvedQuickQuizBankItems } from "./quickQuizApprovedItems";

describe("approvedQuickQuizBankItems", () => {
  it("includes only individually approved quick-quiz questions and keeps their set information", () => {
    const items = approvedQuickQuizBankItems([{ id: 12, subject: "화학 I", unit: "분자", topic: "분자 구분", difficulty: "낮음", questionFormat: "multiple_choice", createdAt: "2026-08-27T03:00:00.000Z", questionReviewStates: ["approved", "rejected", "pending_review"], questions: [
      { questionText: "분자는?", choices: ["① O2", "② NaCl"], answer: "①", explanation: "O2는 분자이다.", concept: "분자" },
      { questionText: "이온은?", choices: [], answer: "Na+", explanation: "설명", concept: "이온" },
      { questionText: "원자는?", choices: [], answer: "H", explanation: "설명", concept: "원자" },
    ] }]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: "quick-quiz-12-0", topic: "분자 구분", exportQuestion: { choices: ["O2", "NaCl"] } });
  });
});
