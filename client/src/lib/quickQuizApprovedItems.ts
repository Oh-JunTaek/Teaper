import type { ExportQuestion } from "./questionExport";

export type QuickQuizQuestion = { questionText: string; choices?: string[]; answer: string; explanation: string; concept?: string };
export type QuickQuizForApprovedBank = { id: number; subject: string; unit: string; topic: string; difficulty: string; questionFormat: string; createdAt: Date | string; questions: QuickQuizQuestion[]; questionReviewStates?: Array<string | null> | null };

export type QuickQuizApprovedBankItem = {
  key: string;
  source: "quick_quiz";
  createdAt: Date | string;
  setId: number;
  topic: string;
  subject: string;
  unit: string;
  exportQuestion: ExportQuestion;
};

/** 쪽지시험 세트에서는 명시적으로 승인한 문항만 승인 문항 보관함으로 변환한다. */
export function approvedQuickQuizBankItems(quizzes: QuickQuizForApprovedBank[]): QuickQuizApprovedBankItem[] {
  return quizzes.flatMap(quiz => quiz.questions.flatMap((question, questionIndex) => {
    if (quiz.questionReviewStates?.[questionIndex] !== "approved") return [];
    return [{
      key: `quick-quiz-${quiz.id}-${questionIndex}`,
      source: "quick_quiz" as const,
      createdAt: quiz.createdAt,
      setId: quiz.id,
      topic: quiz.topic,
      subject: quiz.subject,
      unit: quiz.unit,
      exportQuestion: {
        id: -(quiz.id * 1000 + questionIndex + 1),
        questionText: question.questionText,
        choices: (question.choices || []).map(choice => choice.replace(/^(?:선택\s*)?(?:[①②③④]|[1-4][.)])\s*[:.)-]?\s*/, "").trim()),
        answer: question.answer,
        explanation: question.explanation,
        intent: question.concept || `${quiz.topic} 개념 확인`,
        difficulty: quiz.difficulty,
        points: 1,
        questionType: quiz.questionFormat === "multiple_choice" ? "객관식 4지선다" : quiz.questionFormat === "short_answer" ? "주관식" : "O/X",
      },
    }];
  }));
}
