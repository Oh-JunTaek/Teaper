export type QuickQuizReviewState = "pending_review" | "approved" | "revised" | "rejected";

export type QuickQuizReviewRecord = {
  id: number;
  questionCount: number;
  questionReviewStates?: QuickQuizReviewState[] | null;
  createdAt: Date | string;
};

/** 이전 세트의 빈 상태값은 승인으로 해석하지 않고 문항 수만큼 검수 대기로 계산한다. */
export function normalizedQuickQuizReviewStates(record: QuickQuizReviewRecord): QuickQuizReviewState[] {
  return Array.from({ length: Math.max(1, record.questionCount) }, (_unused, index) => record.questionReviewStates?.[index] ?? "pending_review");
}

/** 미검수 세트·문항의 수와 가장 최근 생성된 미검수 세트를 함께 계산해 교사가 이전 세트를 놓치지 않게 한다. */
export function quickQuizPendingOverview(records: QuickQuizReviewRecord[]) {
  const pendingRecords = records.filter(record => normalizedQuickQuizReviewStates(record).includes("pending_review"));
  const latestPending = [...pendingRecords].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  return {
    pendingSetCount: pendingRecords.length,
    pendingQuestionCount: pendingRecords.reduce((total, record) => total + normalizedQuickQuizReviewStates(record).filter(state => state === "pending_review").length, 0),
    latestPending,
  };
}
